import sqlite3
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime, date

app = FastAPI(
    title="UrQuest API",
    description="Gamified Task Platform for Organizations and Individuals",
    version="5.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "urquest_v5.db"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        
        # 1. Organizations
        c.execute('''CREATE TABLE IF NOT EXISTS organizations (
            org_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            owner_user_id TEXT NOT NULL,
            description TEXT,
            image_url TEXT
        )''')

        # 2. Org Roles
        c.execute('''CREATE TABLE IF NOT EXISTS org_roles (
            role_id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER,
            name TEXT NOT NULL,
            rank INTEGER DEFAULT 1,
            can_create_task BOOLEAN DEFAULT 0,
            FOREIGN KEY(org_id) REFERENCES organizations(org_id)
        )''')

        # 3. Users
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            total_xp INTEGER DEFAULT 0,
            member_org_id INTEGER REFERENCES organizations(org_id),
            org_role_id INTEGER REFERENCES org_roles(role_id)
        )''')
        
        # 4. Tasks
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
        
        # 5. Submissions
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

# --- Schemas ---

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class OrgCreate(BaseModel):
    owner_user_id: str
    name: str

class OrgJoin(BaseModel):
    user_id: str
    org_id: int

class OrgUpdate(BaseModel):
    org_id: int
    user_id: str
    description: Optional[str] = None
    image_url: Optional[str] = None

class OrgLeave(BaseModel):
    user_id: str
    org_id: int

class RoleCreate(BaseModel):
    owner_user_id: str
    org_id: int
    name: str
    rank: int
    can_create_task: bool

class RoleAssign(BaseModel):
    owner_user_id: str
    target_user_id: str
    role_id: int

class TransferOwnership(BaseModel):
    current_owner_id: str
    password: str
    new_owner_id: str
    org_id: int

class TaskCreate(BaseModel):
    user_id: str
    org_id: int
    title: str
    description: str
    xp_reward: int
    difficulty: Literal['Easy', 'Medium', 'Hard']
    deadline: Optional[str] = None

class SubmissionCreate(BaseModel):
    task_id: int
    user_id: str
    proof_link: str

class ReviewAction(BaseModel):
    submission_id: int
    action: Literal['APPROVE', 'REJECT']
    feedback: Optional[str] = None

# --- Helpers ---
def check_task_permission(user_id: str, org_id: int, conn):
    c = conn.cursor()
    c.execute("SELECT owner_user_id FROM organizations WHERE org_id=?", (org_id,))
    org = c.fetchone()
    if org and org[0] == user_id:
        return True
    
    c.execute('''SELECT r.can_create_task FROM users u
                 JOIN org_roles r ON u.org_role_id = r.role_id
                 WHERE u.user_id = ? AND u.member_org_id = ?''', (user_id, org_id))
    perm = c.fetchone()
    if perm and perm[0]:
        return True
    return False

def verify_password(user_id, password, conn):
    c = conn.cursor()
    c.execute("SELECT password FROM users WHERE user_id=?", (user_id,))
    row = c.fetchone()
    return row and row[0] == password

# --- Endpoints ---

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
        raise HTTPException(status_code=400, detail="Username taken")

@app.post("/auth/login", tags=["Auth"])
def login(user: UserLogin):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''SELECT u.*, r.name as role_name, r.can_create_task 
                     FROM users u 
                     LEFT JOIN org_roles r ON u.org_role_id = r.role_id
                     WHERE u.username = ?''', (user.username,))
        u = c.fetchone()
        
        if not u or u['password'] != user.password:
             raise HTTPException(status_code=401, detail="Invalid credentials")
        
        c.execute("SELECT org_id, name, description, image_url FROM organizations WHERE owner_user_id = ?", (u['user_id'],))
        owned_org = c.fetchone()

        member_org = None
        if u['member_org_id']:
            c.execute("SELECT org_id, name, description, image_url FROM organizations WHERE org_id = ?", (u['member_org_id'],))
            member_org = c.fetchone()
        
        return {
            "status": "success",
            "user": {
                "user_id": u['user_id'],
                "username": u['username'],
                "total_xp": u['total_xp'],
                "member_org_id": u['member_org_id'],
                "role_name": u['role_name'],
                "can_create_task": bool(u['can_create_task'])
            },
            "owned_org": dict(owned_org) if owned_org else None,
            "member_org": dict(member_org) if member_org else None
        }

# V5 NEW: Org Public Profile & Leave Logic

@app.get("/orgs/list", tags=["Org"])
def list_orgs():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # Return basic info list
        c.execute("SELECT org_id, name FROM organizations")
        return c.fetchall()

@app.get("/org/public/{org_id}", tags=["Org"])
def get_public_org(org_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT org_id, name, description, image_url, owner_user_id FROM organizations WHERE org_id=?", (org_id,))
        org = c.fetchone()
        if not org: raise HTTPException(status_code=404)
        
        # Get Member Count
        c.execute("SELECT COUNT(*) FROM users WHERE member_org_id=?", (org_id,))
        count = c.fetchone()[0]
        
        return {
            "org_id": org['org_id'],
            "name": org['name'],
            "description": org['description'] or "No briefing available.",
            "image_url": org['image_url'] or "default_faction.png",
            "member_count": count
        }

@app.post("/org/create", tags=["Org"])
def create_org(org: OrgCreate):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            c = conn.cursor()
            c.execute("INSERT INTO organizations (name, owner_user_id) VALUES (?, ?)", (org.name, org.owner_user_id))
            org_id = c.lastrowid
            c.execute("UPDATE users SET member_org_id = ? WHERE user_id = ?", (org_id, org.owner_user_id))
            conn.commit()
            return {"status": "success", "org_id": org_id, "name": org.name}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Name taken")

@app.post("/org/join", tags=["Org"])
def join_org(join: OrgJoin):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET member_org_id = ?, org_role_id=NULL WHERE user_id = ?", (join.org_id, join.user_id))
        conn.commit()
        c.execute("SELECT name FROM organizations WHERE org_id = ?", (join.org_id,))
        name = c.fetchone()[0]
        return {"status": "success", "org_name": name}

@app.post("/org/leave", tags=["Org"])
def leave_org(leave: OrgLeave):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        # Check if owner
        c.execute("SELECT owner_user_id FROM organizations WHERE org_id=?", (leave.org_id,))
        org = c.fetchone()
        if org and org[0] == leave.user_id:
            raise HTTPException(status_code=400, detail="Commander cannot leave. Transfer command first.")
            
        c.execute("UPDATE users SET member_org_id = NULL, org_role_id = NULL WHERE user_id = ?", (leave.user_id,))
        conn.commit()
    return {"status": "success", "message": "Left organization"}

@app.post("/org/update", tags=["Org"])
def update_org(update: OrgUpdate):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        # Verify Owner
        c.execute("SELECT owner_user_id FROM organizations WHERE org_id=?", (update.org_id,))
        org = c.fetchone()
        if not org or org[0] != update.user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        if update.description:
            c.execute("UPDATE organizations SET description=? WHERE org_id=?", (update.description, update.org_id))
        if update.image_url:
            c.execute("UPDATE organizations SET image_url=? WHERE org_id=?", (update.image_url, update.org_id))
        conn.commit()
    return {"status": "success"}

# --- Roles & Transfer Checkpoints ---

@app.post("/org/roles/create", tags=["Advanced Org"])
def create_role(role: RoleCreate):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("SELECT owner_user_id FROM organizations WHERE org_id=?", (role.org_id,))
        org = c.fetchone()
        if not org or org[0] != role.owner_user_id:
            raise HTTPException(status_code=403, detail="Only owner can create roles")
            
        c.execute("INSERT INTO org_roles (org_id, name, rank, can_create_task) VALUES (?, ?, ?, ?)", 
                  (role.org_id, role.name, role.rank, role.can_create_task))
        conn.commit()
    return {"status": "success"}

@app.get("/org/roles", tags=["Advanced Org"])
def get_roles(org_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM org_roles WHERE org_id = ?", (org_id,))
        return c.fetchall()

@app.get("/org/members", tags=["Advanced Org"])
def get_members(org_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''SELECT u.user_id, u.username, u.total_xp, r.name as role_name 
                     FROM users u 
                     LEFT JOIN org_roles r ON u.org_role_id = r.role_id
                     WHERE u.member_org_id = ?''', (org_id,))
        return c.fetchall()

@app.post("/org/roles/assign", tags=["Advanced Org"])
def assign_role(assign: RoleAssign):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET org_role_id = ? WHERE user_id = ?", 
                  (assign.role_id, assign.target_user_id))
        conn.commit()
    return {"status": "success"}

@app.post("/org/transfer-ownership", tags=["Advanced Org"])
def transfer_ownership(transfer: TransferOwnership):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        if not verify_password(transfer.current_owner_id, transfer.password, conn):
            raise HTTPException(status_code=401, detail="Invalid password")
        
        c.execute("SELECT owner_user_id FROM organizations WHERE org_id=?", (transfer.org_id,))
        org = c.fetchone()
        if not org or org[0] != transfer.current_owner_id:
            raise HTTPException(status_code=403, detail="Not the owner")
            
        c.execute("UPDATE organizations SET owner_user_id = ? WHERE org_id = ?", 
                  (transfer.new_owner_id, transfer.org_id))
        conn.commit()
    return {"status": "success", "message": "Ownership transferred"}

@app.post("/tasks/create", tags=["Org"])
def create_task(task: TaskCreate):
    with sqlite3.connect(DB_NAME) as conn:
        if not check_task_permission(task.user_id, task.org_id, conn):
            raise HTTPException(status_code=403, detail="Permission denied")
            
        c = conn.cursor()
        c.execute('''INSERT INTO tasks (creator_org_id, title, description, xp_reward, difficulty, deadline, status) 
                     VALUES (?, ?, ?, ?, ?, ?, 'OPEN')''', 
                  (task.org_id, task.title, task.description, task.xp_reward, task.difficulty, task.deadline))
        conn.commit()
    return {"status": "success"}

# --- Standard Getters ---
@app.get("/org/stats", tags=["Org"])
def get_stats(org_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM tasks WHERE creator_org_id = ? AND status = 'OPEN'", (org_id,))
        active = c.fetchone()[0]
        c.execute('''SELECT COUNT(*) FROM submissions s
                     JOIN tasks t ON s.task_id = t.task_id
                     WHERE t.creator_org_id = ? AND s.status = 'PENDING' ''', (org_id,))
        pending = c.fetchone()[0]
        return {"active_tasks": active, "pending_submissions": pending}

@app.get("/org/reviews", tags=["Org"])
def get_reviews(org_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''SELECT s.submission_id, s.proof_link, t.title as task_title, u.username as student_name, t.xp_reward
                     FROM submissions s
                     JOIN tasks t ON s.task_id=t.task_id
                     JOIN users u ON s.user_id=u.user_id
                     WHERE t.creator_org_id=? AND s.status='PENDING' ''', (org_id,))
        return c.fetchall()

@app.post("/submissions/review", tags=["Org"])
def review(review: ReviewAction):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("SELECT task_id, user_id FROM submissions WHERE submission_id=?", (review.submission_id,))
        sub = c.fetchone()
        
        status = 'APPROVED' if review.action == 'APPROVE' else 'REJECTED'
        c.execute("UPDATE submissions SET status=?, feedback=? WHERE submission_id=?", 
                  (status, review.feedback, review.submission_id))
        
        if status == 'APPROVED':
            c.execute("SELECT xp_reward FROM tasks WHERE task_id=?", (sub[0],))
            xp = c.fetchone()[0]
            c.execute("UPDATE users SET total_xp = total_xp + ? WHERE user_id=?", (xp, sub[1]))
        conn.commit()
    return {"status": "success"}

@app.get("/tasks/available", tags=["User"])
def avail_tasks():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''SELECT t.*, o.name as org_name, o.id as org_id 
                     FROM tasks t JOIN organizations o ON t.creator_org_id=o.org_id 
                     WHERE t.status='OPEN' ''')
        # Note: o.id typo above, should be o.org_id
        # Fixing query
        c.execute('''SELECT t.*, o.name as org_name, o.org_id as org_id_ref
                     FROM tasks t JOIN organizations o ON t.creator_org_id=o.org_id 
                     WHERE t.status='OPEN' ''')
        return c.fetchall()

@app.post("/tasks/submit", tags=["User"])
def submit(sub: SubmissionCreate):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("INSERT INTO submissions (task_id, user_id, proof_link) VALUES (?,?,?)",
                  (sub.task_id, sub.user_id, sub.proof_link))
        conn.commit()
    return {"status": "success"}

@app.get("/user/profile", tags=["User"])
def profile(user_id: str):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''SELECT u.*, r.name as role_name 
                     FROM users u 
                     LEFT JOIN org_roles r ON u.org_role_id = r.role_id
                     WHERE user_id=?''', (user_id,))
        user = c.fetchone()
        
        level = 1 + (user['total_xp'] // 100)
        c.execute("SELECT COUNT(*) FROM users WHERE total_xp > ?", (user['total_xp'],))
        rank = c.fetchone()[0] + 1
        
        c.execute('''SELECT t.title, s.status, s.feedback 
                     FROM submissions s JOIN tasks t ON s.task_id=t.task_id
                     WHERE s.user_id=?''', (user_id,))
        hist = c.fetchall()
        
        return {
            "username": user['username'],
            "total_xp": user['total_xp'],
            "level": level,
            "rank": rank,
            "role_name": user['role_name'],
            "history": hist
        }

@app.get("/leaderboard")
def lb():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT username, total_xp FROM users ORDER BY total_xp DESC LIMIT 10")
        return c.fetchall()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)