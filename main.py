import sqlite3
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime, date

# Initialize the App
app = FastAPI(
    title="UrQuest API",
    description="Gamified Task Platform for Organizations and Individuals",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Setup (SQLite) ---
DB_NAME = "urquest_v3.db"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        
        # 1. Users Table (No Role column, everyone is a user first)
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            total_xp INTEGER DEFAULT 0
        )''')

        # 2. Organizations Table
        c.execute('''CREATE TABLE IF NOT EXISTS organizations (
            org_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            owner_user_id TEXT NOT NULL,
            FOREIGN KEY(owner_user_id) REFERENCES users(user_id)
        )''')
        
        # 3. Tasks Table (Linked to Org)
        c.execute('''CREATE TABLE IF NOT EXISTS tasks (
            task_id INTEGER PRIMARY KEY AUTOINCREMENT,
            creator_org_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            xp_reward INTEGER NOT NULL,
            difficulty TEXT,
            deadline DATE,
            status TEXT DEFAULT 'OPEN',
            FOREIGN KEY(creator_org_id) REFERENCES organizations(org_id)
        )''')
        
        # 4. Submissions Table
        c.execute('''CREATE TABLE IF NOT EXISTS submissions (
            submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            user_id TEXT,
            proof_link TEXT,
            status TEXT DEFAULT 'PENDING',
            feedback TEXT,
            FOREIGN KEY(task_id) REFERENCES tasks(task_id),
            FOREIGN KEY(user_id) REFERENCES users(user_id)
        )''')
        conn.commit()

init_db()

# --- Pydantic Models ---

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class OrgCreate(BaseModel):
    owner_user_id: str
    name: str

class TaskCreate(BaseModel):
    creator_org_id: int
    title: str
    description: str
    xp_reward: int
    difficulty: Literal['Easy', 'Medium', 'Hard']
    deadline: str 

class SubmissionCreate(BaseModel):
    task_id: int
    user_id: str
    proof_link: str

class ReviewAction(BaseModel):
    submission_id: int
    action: Literal['APPROVE', 'REJECT']
    feedback: Optional[str] = None

# --- API Endpoints ---

# 1. Auth Endpoints
@app.post("/auth/register", tags=["Auth"])
def register(user: UserRegister):
    user_id = user.username.lower().replace(" ", "_")
    try:
        with sqlite3.connect(DB_NAME) as conn:
            c = conn.cursor()
            c.execute("INSERT INTO users (user_id, username, password, total_xp) VALUES (?, ?, ?, 0)", 
                      (user_id, user.username, user.password))
            conn.commit()
            return {"status": "success", "user_id": user_id}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")

@app.post("/auth/login", tags=["Auth"])
def login(user: UserLogin):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT user_id, username, total_xp, password FROM users WHERE username = ?", (user.username,))
        u = c.fetchone()
        
        if not u or u['password'] != user.password:
             raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Check if user owns an org
        c.execute("SELECT org_id, name FROM organizations WHERE owner_user_id = ?", (u['user_id'],))
        org = c.fetchone()
        
        return {
            "status": "success",
            "user": {
                "user_id": u['user_id'],
                "username": u['username'],
                "total_xp": u['total_xp']
            },
            "org": {"org_id": org['org_id'], "name": org['name']} if org else None
        }

# 2. Org Management
@app.post("/org/create", tags=["Organization"])
def create_org(org: OrgCreate):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            c = conn.cursor()
            # Check if user already owns one (One Org per User rule for MVP simplicity?)
            c.execute("SELECT org_id FROM organizations WHERE owner_user_id = ?", (org.owner_user_id,))
            if c.fetchone():
                raise HTTPException(status_code=400, detail="You already own an organization")

            c.execute("INSERT INTO organizations (name, owner_user_id) VALUES (?, ?)", 
                      (org.name, org.owner_user_id))
            org_id = c.lastrowid
            conn.commit()
            return {"status": "success", "org_id": org_id, "name": org.name}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Organization name taken")

# 3. Org Actions (Task Create, etc.)
@app.post("/tasks/create", tags=["Organization"])
def create_task(task: TaskCreate):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute('''INSERT INTO tasks (creator_org_id, title, description, xp_reward, difficulty, deadline, status) 
                     VALUES (?, ?, ?, ?, ?, ?, 'OPEN')''', 
                  (task.creator_org_id, task.title, task.description, task.xp_reward, task.difficulty, task.deadline))
        conn.commit()
    return {"status": "success", "message": "Task created"}

@app.get("/org/stats", tags=["Organization"])
def get_org_stats(org_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM tasks WHERE creator_org_id = ? AND status = 'OPEN'", (org_id,))
        active_tasks = c.fetchone()[0]
        
        c.execute('''SELECT COUNT(*) FROM submissions s
                     JOIN tasks t ON s.task_id = t.task_id
                     WHERE t.creator_org_id = ? AND s.status = 'PENDING' ''', (org_id,))
        pending = c.fetchone()[0]
        return {"active_tasks": active_tasks, "pending_submissions": pending}

@app.get("/org/reviews", tags=["Organization"])
def get_reviews(org_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''SELECT s.submission_id, s.proof_link, t.title as task_title, u.username as student_name, t.xp_reward
                     FROM submissions s
                     JOIN tasks t ON s.task_id = t.task_id
                     JOIN users u ON s.user_id = u.user_id
                     WHERE t.creator_org_id = ? AND s.status = 'PENDING' ''', (org_id,))
        return c.fetchall()

@app.post("/submissions/review", tags=["Organization"])
def review_submission(review: ReviewAction):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("SELECT task_id, user_id, status FROM submissions WHERE submission_id = ?", (review.submission_id,))
        sub = c.fetchone()
        if not sub or sub[2] != 'PENDING':
            raise HTTPException(status_code=400, detail="Invalid submission")
        
        new_status = 'APPROVED' if review.action == 'APPROVE' else 'REJECTED'
        c.execute("UPDATE submissions SET status = ?, feedback = ? WHERE submission_id = ?", 
                  (new_status, review.feedback, review.submission_id))
        
        if new_status == 'APPROVED':
            c.execute("SELECT xp_reward FROM tasks WHERE task_id = ?", (sub[0],))
            xp = c.fetchone()[0]
            c.execute("UPDATE users SET total_xp = total_xp + ? WHERE user_id = ?", (xp, sub[1]))
        conn.commit()
    return {"status": "success"}

# 4. User Actions
@app.get("/tasks/available", tags=["User"])
def get_tasks():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # Join with organization name for better UI
        c.execute('''SELECT t.*, o.name as org_name 
                     FROM tasks t 
                     JOIN organizations o ON t.creator_org_id = o.org_id 
                     WHERE t.status='OPEN' ''')
        return c.fetchall()

@app.post("/tasks/submit", tags=["User"])
def submit_task(sub: SubmissionCreate):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM submissions WHERE task_id = ? AND user_id = ?", (sub.task_id, sub.user_id))
        if c.fetchone():
            raise HTTPException(status_code=400, detail="Already submitted")
        c.execute("INSERT INTO submissions (task_id, user_id, proof_link) VALUES (?, ?, ?)",
                  (sub.task_id, sub.user_id, sub.proof_link))
        conn.commit()
    return {"status": "success"}

@app.get("/user/profile", tags=["User"])
def get_profile(user_id: str):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT username, total_xp FROM users WHERE user_id = ?", (user_id,))
        user = c.fetchone()
        if not user: raise HTTPException(status_code=404)
        
        level = 1 + (user['total_xp'] // 100)
        
        c.execute("SELECT COUNT(*) FROM users WHERE total_xp > ?", (user['total_xp'],))
        rank = c.fetchone()[0] + 1
        
        c.execute('''SELECT t.title, s.status, s.feedback, t.xp_reward 
                     FROM submissions s
                     JOIN tasks t ON s.task_id = t.task_id
                     WHERE s.user_id = ?''', (user_id,))
        history = c.fetchall()
        
        return {
            "username": user['username'],
            "total_xp": user['total_xp'],
            "level": level,
            "rank": rank,
            "history": history
        }

@app.get("/leaderboard", tags=["Generic"])
def leaderboard():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT username, total_xp FROM users ORDER BY total_xp DESC LIMIT 10")
        return c.fetchall()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)