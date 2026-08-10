from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime
import uuid

class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True)
    password = Column(String, nullable=True) # Nullable for Google auth
    profile_picture = Column(String, nullable=True)
    provider = Column(String, default="email")
    total_xp = Column(Integer, default=0)
    member_org_id = Column(Integer, ForeignKey("organizations.org_id"), nullable=True)
    org_role_id = Column(Integer, ForeignKey("org_roles.role_id"), nullable=True)

    member_org = relationship("Organization", foreign_keys=[member_org_id], back_populates="members")
    role = relationship("OrgRole")
    owned_orgs = relationship("Organization", foreign_keys="Organization.owner_user_id", back_populates="owner")
    created_tasks = relationship("Task", back_populates="creator")
    submissions = relationship("Submission", back_populates="user")


class Organization(Base):
    __tablename__ = "organizations"

    org_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    owner_user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)

    owner = relationship("User", foreign_keys=[owner_user_id], back_populates="owned_orgs")
    members = relationship("User", foreign_keys="User.member_org_id", back_populates="member_org")
    roles = relationship("OrgRole", back_populates="organization")
    tasks = relationship("Task", back_populates="creator_org")


class OrgRole(Base):
    __tablename__ = "org_roles"

    role_id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.org_id"), nullable=False)
    name = Column(String, nullable=False)
    rank = Column(Integer, default=1)
    can_create_task = Column(Boolean, default=False)

    organization = relationship("Organization", back_populates="roles")


class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(Integer, primary_key=True, index=True)
    creator_org_id = Column(Integer, ForeignKey("organizations.org_id"), nullable=True)
    creator_user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    xp_reward = Column(Integer, nullable=False)
    difficulty = Column(String, nullable=True)
    deadline = Column(String, nullable=True) # Keeping string for simplicity as in original DB
    status = Column(String, default="OPEN")
    visibility = Column(String, default="PUBLIC")
    assignee_ids = Column(String, nullable=True) # JSON string of user IDs

    creator_org = relationship("Organization", back_populates="tasks")
    creator = relationship("User", back_populates="created_tasks")
    submissions = relationship("Submission", back_populates="task")


class Submission(Base):
    __tablename__ = "submissions"

    submission_id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.task_id"), nullable=False)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    proof_link = Column(String, nullable=True)
    status = Column(String, default="PENDING")
    feedback = Column(String, nullable=True)

    task = relationship("Task", back_populates="submissions")
    user = relationship("User", back_populates="submissions")
