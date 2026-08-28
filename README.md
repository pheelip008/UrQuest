# 🛡️ UrQuest

**UrQuest** is a gamified task management platform that transforms work and collaboration into an RPG-like experience. Organizations can create "quests" (tasks), and users (agents) can accept these quests, submit proof of completion, and earn XP to level up their ranks. 

Whether you're managing a community, an open-source project, or a remote team, UrQuest turns mundane tasks into engaging missions.

---

## ✨ Key Features

- **Gamified Task Board:** Browse, accept, and submit proof for quests.
- **Leveling & XP System:** Earn XP for completed quests. Level up through ranks (e.g., Rookie, Operative, Specialist).
- **Organizations (Factions):** Create or join organizations. Org owners can manage members, post quests, and review submissions.
- **Submission Review:** Orgs can approve or reject submissions, with feedback.
- **Leaderboards:** Compete with other agents for the top spot.
- **Sleek Cyber/Glassmorphic UI:** A dark-themed, modern interface built for immersion.
- **Authentication:** Secure JWT-based authentication and session management.

## 🛠️ Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL (or SQLite for local dev)
- **Frontend:** Vanilla HTML, CSS (Custom Design System), JavaScript
- **Authentication:** JWT, passlib (bcrypt)
- **Uploads:** Local file handling for avatars and quest assets

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- PostgreSQL (Optional, defaults to SQLite if not configured)

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/pheelip008/UrQuest.git
   cd UrQuest
   ```

2. **Set up the backend**
   Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   JWT_SECRET=your_super_secret_jwt_key
   JWT_ALGORITHM=HS256
   # Optionally add PostgreSQL connection string:
   # DATABASE_URL=postgresql://user:password@localhost/urquest
   ```

4. **Run the Backend Server**
   Start the FastAPI server using Uvicorn:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://127.0.0.1:8000`. You can view the interactive API documentation at `http://127.0.0.1:8000/docs`.

5. **Run the Frontend**
   Since the frontend uses vanilla HTML/JS/CSS, you can simply serve the static files. If you have VS Code, use the **Live Server** extension.
   Alternatively, use Python's built-in HTTP server:
   ```bash
   python -m http.server 5500
   ```
   Then open `http://localhost:5500` in your browser.

## 🗺️ Roadmap & Upcoming Features

- **Badges & Achievements:** Unlock badges for specific milestones.
- **Quest Lifecycle & Categories:** Better filtering and tags for quests.
- **User Profiles:** Dedicated pages to show off ranks, badges, and history.
- **Real-time Notifications:** In-app updates for quest approvals and XP gains.
- **Search & Analytics:** Organization leaderboards and global search.

Check out [`urquest_feature_audit.md`](urquest_feature_audit.md) for a complete breakdown of planned features and ongoing fixes.

## 🤝 Contributing

Contributions are welcome! If you'd like to improve UrQuest, please fork the repository, create a new branch, and submit a Pull Request.

## 📝 License

meh

