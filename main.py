import os
import json
import httpx
import re
from datetime import datetime, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, HTTPException, Body, Depends, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

import jwt
from passlib.context import CryptContext

from database import get_db, engine, Base
import models
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_CALLBACK_URL = os.getenv("GOOGLE_CALLBACK_URL")
CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "http://127.0.0.1:5500")
IS_PRODUCTION = os.getenv("NODE_ENV") == "production" or os.getenv("RENDER") is not None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

app = FastAPI(
    title="UrQuest API",
    description="Gamified Task Platform for Organizations and Individuals",
    version="6.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_ORIGIN, "http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB (Create tables)
Base.metadata.create_all(bind=engine)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- Dependencies ---
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("userId")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(models.User).filter(models.User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Schemas ---
class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str
    rememberMe: bool = False

class OrgCreate(BaseModel):
    name: str

class OrgJoin(BaseModel):
    org_id: int

class OrgUpdate(BaseModel):
    org_id: int
    description: Optional[str] = None
    image_url: Optional[str] = None
    name: Optional[str] = None

class OrgLeave(BaseModel):
    org_id: int

class RoleCreate(BaseModel):
    org_id: int
    name: str
    rank: int
    can_create_task: bool

class RoleAssign(BaseModel):
    target_user_id: str
    role_id: int

class TransferOwnership(BaseModel):
    password: str
    new_owner_id: str
    org_id: int

class TaskCreate(BaseModel):
    org_id: Optional[int] = None
    title: str
    description: str
    xp_reward: int
    difficulty: Literal['Easy', 'Medium', 'Hard']
    category: Optional[str] = None
    deadline: Optional[str] = None
    visibility: Literal['PUBLIC', 'PRIVATE'] = 'PUBLIC'
    assignee_ids: Optional[List[str]] = []

class SubmissionCreate(BaseModel):
    task_id: int
    proof_link: str

class ReviewAction(BaseModel):
    submission_id: int
    action: Literal['APPROVE', 'REJECT']
    feedback: Optional[str] = None

class CommentCreate(BaseModel):
    content: str

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class OrgInviteCreate(BaseModel):
    org_id: int
    max_uses: Optional[int] = None

# --- Helpers ---
def create_token_cookie(response: Response, user_id: str):
    payload = {
        "userId": user_id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        samesite="none" if IS_PRODUCTION else "lax",
        secure=IS_PRODUCTION,
        max_age=7 * 24 * 60 * 60
    )

def check_org_task_permission(user_id: str, org_id: int, db: Session):
    org = db.query(models.Organization).filter(models.Organization.org_id == org_id).first()
    if org and org.owner_user_id == user_id:
        return True
    
    user = db.query(models.User).filter(models.User.user_id == user_id, models.User.member_org_id == org_id).first()
    if user and user.role and user.role.can_create_task:
        return True
    return False

# --- Endpoints ---

@app.get("/auth/google")
def google_login():
    url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOGLE_CLIENT_ID}&redirect_uri={GOOGLE_CALLBACK_URL}&response_type=code&scope=email profile"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url)

@app.get("/auth/google/callback")
async def google_callback(code: str, response: Response, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        # 1. Get access token
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": GOOGLE_CALLBACK_URL
        })
        token_data = token_res.json()
        if "access_token" not in token_data:
            raise HTTPException(status_code=400, detail="Google Auth Failed")

        # 2. Get user info
        user_res = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={
            "Authorization": f"Bearer {token_data['access_token']}"
        })
        user_info = user_res.json()
        email = user_info.get("email")
        google_id = user_info.get("id")
        name = user_info.get("name")
        picture = user_info.get("picture")

        # 3. Find or create user
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(
                user_id=google_id,
                username=name or email.split("@")[0],
                email=email,
                profile_picture=picture,
                provider="google"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 4. Set Cookie and redirect
        create_token_cookie(response, user.user_id)
        
        from fastapi.responses import RedirectResponse
        res = RedirectResponse(f"{CLIENT_ORIGIN}/user-dashboard.html")
        create_token_cookie(res, user.user_id)
        return res

@app.post("/api/upload", tags=["Upload"])
async def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user)):
    # Generate unique filename to prevent overwrites
    import uuid
    ext = file.filename.split('.')[-1] if '.' in file.filename else ''
    filename = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
    file_location = f"uploads/{filename}"
    
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    return {"url": f"/{file_location}"}

@app.post("/api/auth/register", tags=["Auth"])
def register(user: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(
        or_(models.User.username == user.username, models.User.email == user.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email taken")

    new_user = models.User(
        username=user.username,
        email=user.email,
        password=get_password_hash(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"success": True, "user_id": new_user.user_id}

@app.post("/api/auth/login", tags=["Auth"])
def login(user: UserLogin, response: Response, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.email == user.email).first()
    if not u or not u.password or not verify_password(user.password, u.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    create_token_cookie(response, u.user_id)

    owned_org = db.query(models.Organization).filter(models.Organization.owner_user_id == u.user_id).first()
    member_org = u.member_org

    return {
        "success": True,
        "user": {
            "user_id": u.user_id,
            "username": u.username,
            "total_xp": u.total_xp,
            "member_org_id": u.member_org_id,
            "role_name": u.role.name if u.role else None,
            "can_create_task": u.role.can_create_task if u.role else False
        },
        "owned_org": {"org_id": owned_org.org_id, "name": owned_org.name, "image_url": owned_org.image_url} if owned_org else None,
        "member_org": {"org_id": member_org.org_id, "name": member_org.name, "image_url": member_org.image_url} if member_org else None
    }

@app.get("/api/auth/me", tags=["Auth"])
def get_me(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned_org = db.query(models.Organization).filter(models.Organization.owner_user_id == user.user_id).first()
    member_org = user.member_org
    return {
        "success": True,
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "total_xp": user.total_xp,
            "member_org_id": user.member_org_id,
            "role_name": user.role.name if user.role else None,
            "can_create_task": user.role.can_create_task if user.role else False
        },
        "owned_org": {"org_id": owned_org.org_id, "name": owned_org.name, "image_url": owned_org.image_url} if owned_org else None,
        "member_org": {"org_id": member_org.org_id, "name": member_org.name, "image_url": member_org.image_url} if member_org else None
    }

@app.post("/api/auth/logout", tags=["Auth"])
def logout(response: Response):
    response.delete_cookie(
        "token",
        samesite="none" if IS_PRODUCTION else "lax",
        secure=IS_PRODUCTION
    )
    return {"status": "success"}

@app.get("/api/orgs/list", tags=["Org"])
def list_orgs(db: Session = Depends(get_db)):
    orgs = db.query(models.Organization).all()
    return [{"org_id": o.org_id, "name": o.name} for o in orgs]

@app.get("/api/org/public/{org_id}", tags=["Org"])
def get_public_org(org_id: int, db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter(models.Organization.org_id == org_id).first()
    if not org:
        raise HTTPException(status_code=404)
    count = db.query(models.User).filter(models.User.member_org_id == org_id).count()
    return {
        "org_id": org.org_id,
        "name": org.name,
        "description": org.description or "No briefing available.",
        "image_url": org.image_url or "default_faction.png",
        "member_count": count
    }

@app.post("/api/org/create", tags=["Org"])
def create_org(org: OrgCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.Organization).filter(models.Organization.name == org.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Name taken")
    
    new_org = models.Organization(name=org.name, owner_user_id=current_user.user_id)
    db.add(new_org)
    db.commit()
    db.refresh(new_org)

    current_user.member_org_id = new_org.org_id
    db.commit()

    return {"status": "success", "org_id": new_org.org_id, "name": new_org.name}

@app.post("/api/org/join", tags=["Org"])
def join_org(join: OrgJoin, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.org_id == join.org_id).first()
    if not org:
        raise HTTPException(status_code=404)
    
    current_user.member_org_id = join.org_id
    current_user.org_role_id = None
    db.commit()
    return {"status": "success", "org_name": org.name}

@app.post("/api/org/leave", tags=["Org"])
def leave_org(leave: OrgLeave, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.org_id == leave.org_id).first()
    if org and org.owner_user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Commander cannot leave. Transfer command first.")
    
    current_user.member_org_id = None
    current_user.org_role_id = None
    db.commit()
    return {"status": "success", "message": "Left organization"}

@app.post("/api/org/update", tags=["Org"])
def update_org(update: OrgUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.org_id == update.org_id).first()
    if not org or org.owner_user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if update.description: org.description = update.description
    if update.image_url: org.image_url = update.image_url
    if update.name: org.name = update.name
    
    db.commit()
    return {"status": "success"}

@app.post("/api/tasks/create", tags=["Tasks"])
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if task.visibility == 'PRIVATE':
        if not task.org_id:
            raise HTTPException(status_code=400, detail="Private tasks must have an Organization.")
        if not check_org_task_permission(current_user.user_id, task.org_id, db):
            raise HTTPException(status_code=403, detail="Permission denied for Org Task")
    else:
        if task.org_id:
             if not check_org_task_permission(current_user.user_id, task.org_id, db):
                raise HTTPException(status_code=403, detail="Permission denied for Org Task")

    new_task = models.Task(
        creator_org_id=task.org_id,
        creator_user_id=current_user.user_id,
        title=task.title,
        description=task.description,
        xp_reward=task.xp_reward,
        difficulty=task.difficulty,
        category=task.category,
        deadline=task.deadline,
        visibility=task.visibility,
        assignee_ids=json.dumps(task.assignee_ids or [])
    )
    db.add(new_task)
    db.commit()
    return {"status": "success"}

@app.get("/api/tasks/available", tags=["Tasks"])
@app.get("/api/tasks", tags=["Tasks"])
def avail_tasks(
    db: Session = Depends(get_db),
    request: Request = None,
    difficulty: Optional[str] = None,
    category: Optional[str] = None,
    visibility: Optional[str] = None,
    min_xp: Optional[int] = None,
    max_xp: Optional[int] = None,
    sort_by: Optional[str] = None,  # 'xp_asc', 'xp_desc', 'newest', 'deadline'
):
    # Try to get current user optionally
    user_id = None
    member_org_id = None
    token = request.cookies.get("token") if request else None
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("userId")
            if user_id:
                u = db.query(models.User).filter(models.User.user_id == user_id).first()
                if u:
                    member_org_id = u.member_org_id
        except:
            pass

    query = db.query(models.Task).filter(models.Task.status == 'OPEN')
    
    # Apply filters
    if difficulty:
        query = query.filter(models.Task.difficulty == difficulty)
    if category:
        query = query.filter(models.Task.category == category)
    if visibility:
        query = query.filter(models.Task.visibility == visibility)
    if min_xp is not None:
        query = query.filter(models.Task.xp_reward >= min_xp)
    if max_xp is not None:
        query = query.filter(models.Task.xp_reward <= max_xp)
    
    # Apply sorting
    if sort_by == 'xp_asc':
        query = query.order_by(models.Task.xp_reward.asc())
    elif sort_by == 'xp_desc':
        query = query.order_by(models.Task.xp_reward.desc())
    elif sort_by == 'deadline':
        query = query.order_by(models.Task.deadline.asc())
    else:  # default: newest first
        query = query.order_by(models.Task.task_id.desc())
    
    all_tasks = query.all()
    tasks_res = []
    
    for t in all_tasks:
        is_visible = False
        if t.visibility == 'PUBLIC':
            is_visible = True
        elif t.visibility == 'PRIVATE' and user_id:
            assignees = json.loads(t.assignee_ids or '[]')
            if user_id in assignees:
                is_visible = True
            elif member_org_id and t.creator_org_id == member_org_id:
                is_visible = True
        
        if is_visible:
            tasks_res.append({
                "task_id": t.task_id,
                "title": t.title,
                "description": t.description,
                "xp_reward": t.xp_reward,
                "difficulty": t.difficulty,
                "category": t.category,
                "deadline": t.deadline,
                "status": t.status,
                "visibility": t.visibility,
                "assignee_ids": t.assignee_ids,
                "creator_org_id": t.creator_org_id,
                "creator_user_id": t.creator_user_id,
                "org_name": t.creator_org.name if t.creator_org else None,
                "creator_name": t.creator.username if t.creator else None,
                "accepted": any(a.user_id == user_id and a.status != 'ABANDONED' for a in t.acceptances) if user_id else False,
                "acceptance_count": len(t.acceptances)
            })
            
    return tasks_res

@app.post("/api/tasks/{task_id}/accept", tags=["Tasks"])
def accept_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.task_id == task_id, models.Task.status == 'OPEN').first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not open")

    if task.creator_user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Creator cannot accept their own task")

    # Check if already accepted
    existing = db.query(models.TaskAcceptance).filter(
        models.TaskAcceptance.task_id == task_id,
        models.TaskAcceptance.user_id == current_user.user_id,
        models.TaskAcceptance.status == 'IN_PROGRESS'
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Task already accepted")

    acc = models.TaskAcceptance(task_id=task_id, user_id=current_user.user_id)
    db.add(acc)
    
    # Notify creator
    notif = models.Notification(
        user_id=task.creator_user_id,
        message=f"Agent {current_user.username} has accepted mission: {task.title}"
    )
    db.add(notif)
    
    db.commit()
    return {"status": "success", "message": "Quest Accepted"}

@app.post("/api/tasks/{task_id}/comments", tags=["Tasks"])
def add_comment(task_id: int, comment: CommentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_comment = models.Comment(task_id=task_id, user_id=current_user.user_id, content=comment.content)
    db.add(new_comment)
    
    task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if task and task.creator_user_id != current_user.user_id:
        note = models.Notification(user_id=task.creator_user_id, message=f"{current_user.username} commented on '{task.title}'")
        db.add(note)
        
    db.commit()
    return {"status": "success"}

@app.get("/api/tasks/{task_id}/comments", tags=["Tasks"])
def get_comments(task_id: int, db: Session = Depends(get_db)):
    comments = db.query(models.Comment).filter(models.Comment.task_id == task_id).order_by(models.Comment.created_at.asc()).all()
    return [{"id": c.id, "user": c.user.username, "content": c.content, "created_at": c.created_at} for c in comments]

@app.get("/api/notifications", tags=["Notifications"])
def get_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    notes = db.query(models.Notification).filter(models.Notification.user_id == current_user.user_id).order_by(models.Notification.created_at.desc()).limit(20).all()
    return [{"id": n.id, "message": n.message, "is_read": n.is_read, "created_at": n.created_at} for n in notes]

@app.post("/api/tasks/submit", tags=["User"])
def submit(sub: SubmissionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify task was accepted
    acc = db.query(models.TaskAcceptance).filter(
        models.TaskAcceptance.task_id == sub.task_id,
        models.TaskAcceptance.user_id == current_user.user_id,
        models.TaskAcceptance.status == 'IN_PROGRESS'
    ).first()

    if not acc:
        raise HTTPException(status_code=400, detail="You must accept the quest before submitting.")

    acc.status = 'SUBMITTED'

    new_sub = models.Submission(
        task_id=sub.task_id,
        user_id=current_user.user_id,
        proof_link=sub.proof_link
    )
    db.add(new_sub)
    db.commit()
    return {"status": "success"}

@app.post("/api/submissions/review", tags=["Org"])
def review(review: ReviewAction, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    sub = db.query(models.Submission).filter(models.Submission.submission_id == review.submission_id).first()
    if not sub:
        raise HTTPException(status_code=404)
        
    status = 'APPROVED' if review.action == 'APPROVE' else 'REJECTED'
    sub.status = status
    sub.feedback = review.feedback
    
    if status == 'APPROVED':
        # Close the task
        sub.task.status = 'COMPLETED'
        
        u = db.query(models.User).filter(models.User.user_id == sub.user_id).first()
        if u:
            # XP Multiplier based on difficulty
            base_xp = sub.task.xp_reward
            difficulty = sub.task.difficulty
            if difficulty == 'Medium':
                xp_earned = int(base_xp * 1.5)
            elif difficulty == 'Hard':
                xp_earned = int(base_xp * 2.0)
            else:
                xp_earned = base_xp
            u.total_xp += xp_earned
            
            # Notify the submitter
            note = models.Notification(
                user_id=sub.user_id,
                message=f"Your submission for '{sub.task.title}' was APPROVED! +{xp_earned} XP"
            )
            db.add(note)
    elif status == 'REJECTED':
        note = models.Notification(
            user_id=sub.user_id,
            message=f"Your submission for '{sub.task.title}' was REJECTED. Feedback: {review.feedback or 'None'}"
        )
        db.add(note)
            
    db.commit()
    return {"status": "success"}

@app.get("/api/org/stats", tags=["Org"])
def get_stats(org_id: int, db: Session = Depends(get_db)):
    active = db.query(models.Task).filter(models.Task.creator_org_id == org_id, models.Task.status == 'OPEN').count()
    pending = db.query(models.Submission).join(models.Task).filter(models.Task.creator_org_id == org_id, models.Submission.status == 'PENDING').count()
    return {"active_tasks": active, "pending_submissions": pending}

@app.get("/api/org/reviews", tags=["Org"])
def get_reviews(org_id: int, db: Session = Depends(get_db)):
    subs = db.query(models.Submission).join(models.Task).filter(models.Task.creator_org_id == org_id, models.Submission.status == 'PENDING').all()
    res = []
    for s in subs:
        res.append({
            "submission_id": s.submission_id,
            "proof_link": s.proof_link,
            "task_title": s.task.title,
            "student_name": s.user.username,
            "xp_reward": s.task.xp_reward
        })
    return res

@app.get("/api/user/profile", tags=["User"])
def profile(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)
        
    level = 1 + (user.total_xp // 100)
    rank = db.query(models.User).filter(models.User.total_xp > user.total_xp).count() + 1
    
    history = []
    for s in user.submissions:
        history.append({
            "title": s.task.title,
            "status": s.status
        })
        
    return {
        "username": user.username, 
        "total_xp": user.total_xp, 
        "level": level, 
        "rank": rank, 
        "role_name": user.role.name if user.role else None, 
        "history": history
    }

@app.get("/api/user/badges", tags=["User"])
def get_badges(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)
    
    return [
        {
            "name": ub.badge.name,
            "description": ub.badge.description,
            "icon": ub.badge.icon,
            "unlocked_at": ub.unlocked_at
        } for ub in user.badges
    ]

@app.get("/api/leaderboard")
def lb(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.total_xp.desc()).limit(10).all()
    return [{"username": u.username, "total_xp": u.total_xp} for u in users]

@app.post("/api/org/roles/create", tags=["Advanced Org"])
def create_role(role: RoleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.org_id == role.org_id).first()
    if not org or org.owner_user_id != current_user.user_id: 
        raise HTTPException(status_code=403, detail="Owner only")
        
    new_role = models.OrgRole(
        org_id=role.org_id,
        name=role.name,
        rank=role.rank,
        can_create_task=role.can_create_task
    )
    db.add(new_role)
    db.commit()
    return {"status": "success"}

@app.get("/api/org/roles", tags=["Advanced Org"])
def get_roles(org_id: int, db: Session = Depends(get_db)):
    roles = db.query(models.OrgRole).filter(models.OrgRole.org_id == org_id).all()
    return [{"role_id": r.role_id, "name": r.name, "rank": r.rank, "can_create_task": r.can_create_task} for r in roles]

@app.get("/api/org/members", tags=["Advanced Org"])
def get_members(org_id: int, db: Session = Depends(get_db)):
    members = db.query(models.User).filter(models.User.member_org_id == org_id).all()
    return [{
        "user_id": m.user_id,
        "username": m.username,
        "total_xp": m.total_xp,
        "role_name": m.role.name if m.role else None
    } for m in members]

@app.post("/api/org/roles/assign", tags=["Advanced Org"])
def assign_role(assign: RoleAssign, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Add ownership checks in real app
    user = db.query(models.User).filter(models.User.user_id == assign.target_user_id).first()
    if user:
        user.org_role_id = assign.role_id
        db.commit()
    return {"status": "success"}

# --- USER SETTINGS ---

@app.put("/api/user/update-profile", tags=["User"])
def update_profile(profile: ProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if profile.username:
        existing = db.query(models.User).filter(models.User.username == profile.username, models.User.user_id != current_user.user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = profile.username
    if profile.bio is not None:
        current_user.bio = profile.bio
    db.commit()
    return {"status": "success", "username": current_user.username, "bio": current_user.bio}

@app.put("/api/user/change-password", tags=["User"])
def change_password(pw: PasswordChange, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.password:
        raise HTTPException(status_code=400, detail="OAuth accounts cannot change password")
    if not verify_password(pw.current_password, current_user.password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    current_user.password = get_password_hash(pw.new_password)
    db.commit()
    return {"status": "success"}

@app.post("/api/notifications/read", tags=["Notifications"])
def mark_notifications_read(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "success"}

@app.get("/api/notifications/count", tags=["Notifications"])
def unread_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id,
        models.Notification.is_read == False
    ).count()
    return {"count": count}

# --- SEARCH ---

@app.get("/api/search", tags=["Search"])
def search(q: str, db: Session = Depends(get_db)):
    if len(q) < 2:
        return {"quests": [], "orgs": [], "users": []}
    
    pattern = f"%{q}%"
    
    quests = db.query(models.Task).filter(
        models.Task.status == 'OPEN',
        models.Task.visibility == 'PUBLIC',
        or_(models.Task.title.ilike(pattern), models.Task.description.ilike(pattern))
    ).limit(10).all()
    
    orgs = db.query(models.Organization).filter(
        models.Organization.name.ilike(pattern)
    ).limit(10).all()
    
    users = db.query(models.User).filter(
        models.User.username.ilike(pattern)
    ).limit(10).all()
    
    return {
        "quests": [{"task_id": t.task_id, "title": t.title, "xp_reward": t.xp_reward, "difficulty": t.difficulty} for t in quests],
        "orgs": [{"org_id": o.org_id, "name": o.name} for o in orgs],
        "users": [{"user_id": u.user_id, "username": u.username, "total_xp": u.total_xp} for u in users]
    }

# --- ORG INVITES ---

@app.post("/api/org/invite/create", tags=["Org Invites"])
def create_invite(invite: OrgInviteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.org_id == invite.org_id).first()
    if not org or org.owner_user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the org owner can create invites")
    
    new_invite = models.OrgInvite(
        org_id=invite.org_id,
        created_by=current_user.user_id,
        max_uses=invite.max_uses
    )
    db.add(new_invite)
    db.commit()
    db.refresh(new_invite)
    return {"status": "success", "invite_code": new_invite.invite_code}

@app.post("/api/org/invite/join/{invite_code}", tags=["Org Invites"])
def join_via_invite(invite_code: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    invite = db.query(models.OrgInvite).filter(
        models.OrgInvite.invite_code == invite_code,
        models.OrgInvite.is_active == True
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invite")
    
    if invite.max_uses and invite.uses >= invite.max_uses:
        raise HTTPException(status_code=400, detail="Invite link has reached maximum uses")
    
    org = db.query(models.Organization).filter(models.Organization.org_id == invite.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    current_user.member_org_id = invite.org_id
    current_user.org_role_id = None
    invite.uses += 1
    db.commit()
    return {"status": "success", "org_name": org.name}

@app.get("/api/org/invites", tags=["Org Invites"])
def list_invites(org_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.org_id == org_id).first()
    if not org or org.owner_user_id != current_user.user_id:
        raise HTTPException(status_code=403)
    invites = db.query(models.OrgInvite).filter(models.OrgInvite.org_id == org_id, models.OrgInvite.is_active == True).all()
    return [{"id": i.id, "invite_code": i.invite_code, "uses": i.uses, "max_uses": i.max_uses, "created_at": i.created_at} for i in invites]

# --- ORG ANALYTICS ---

@app.get("/api/org/analytics", tags=["Org Analytics"])
def org_analytics(org_id: int, db: Session = Depends(get_db)):
    # Total members
    member_count = db.query(models.User).filter(models.User.member_org_id == org_id).count()
    
    # Total tasks created
    total_tasks = db.query(models.Task).filter(models.Task.creator_org_id == org_id).count()
    
    # Total submissions
    total_subs = db.query(models.Submission).join(models.Task).filter(models.Task.creator_org_id == org_id).count()
    
    # Approved vs Rejected
    approved = db.query(models.Submission).join(models.Task).filter(
        models.Task.creator_org_id == org_id, models.Submission.status == 'APPROVED'
    ).count()
    rejected = db.query(models.Submission).join(models.Task).filter(
        models.Task.creator_org_id == org_id, models.Submission.status == 'REJECTED'
    ).count()
    pending = db.query(models.Submission).join(models.Task).filter(
        models.Task.creator_org_id == org_id, models.Submission.status == 'PENDING'
    ).count()
    
    # Total XP distributed
    total_xp = db.query(func.sum(models.Task.xp_reward)).join(models.Submission).filter(
        models.Task.creator_org_id == org_id, models.Submission.status == 'APPROVED'
    ).scalar() or 0
    
    return {
        "member_count": member_count,
        "total_tasks": total_tasks,
        "total_submissions": total_subs,
        "approved": approved,
        "rejected": rejected,
        "pending": pending,
        "total_xp_distributed": total_xp
    }

@app.get("/api/org/leaderboard", tags=["Org Analytics"])
def org_leaderboard(org_id: int, db: Session = Depends(get_db)):
    members = db.query(models.User).filter(
        models.User.member_org_id == org_id
    ).order_by(models.User.total_xp.desc()).limit(20).all()
    return [
        {"user_id": m.user_id, "username": m.username, "total_xp": m.total_xp, "role_name": m.role.name if m.role else None}
        for m in members
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)