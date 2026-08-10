# UrQuest — Full Functionality Audit & Feature Roadmap

A complete breakdown of **what's placeholder**, **what's incomplete**, and **what can be added** — across all 3 pages, the JS logic, the Node.js API, and the Prisma/PostgreSQL schema.

---

## 🔴 SECTION 1: Placeholders & Stubs (UI exists, logic doesn't)

These are buttons, tabs, and UI elements that are visible in the HTML but either call functions that don't exist or lead nowhere.

---

### 1.1 — Organization Toggle on Login Page
| | Details |
|---|---|
| **Where** | [index.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/index.html) — Role Toggle (`AGENT` / `ORGANIZATION`) |
| **Problem** | The toggle calls `app.setRole('user')` and `app.setRole('org')` — but `app.setRole()` **does not exist** in [app.js](file:///g:/WEB_DEV_n_SHIT/UrQuest/app.js). Clicking "Organization" does nothing. |
| **What it should do** | Switch the login form to an org-specific login flow. Org owners should log in the same way but get redirected to `org-dashboard.html` instead of `user-dashboard.html`. |
| **How to implement** |
| Frontend | Add `app.setRole(role)` that stores the selected role in a variable. On login success, check the role: if `'org'` → redirect to `org-dashboard.html`, if `'user'` → redirect to `user-dashboard.html`. |
| Backend | No changes needed — auth is the same for both. The `/api/auth/me` response already includes `owned_org` which tells us if the user owns an org. |
| Database | No changes needed. |

---

### 1.2 — Notifications Bell (User + Org Dashboards)
| | Details |
|---|---|
| **Where** | [user-dashboard.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/user-dashboard.html) and [org-dashboard.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/org-dashboard.html) — 🔔 icon button in top app bar |
| **Problem** | The notification bell icon is a static `<button>` with no `onclick` handler. No notification system exists. |
| **What it should do** | Show a dropdown with real-time notifications: "Your submission was approved", "New quest available", "You earned 100 XP", etc. |
| **How to implement** |
| Frontend | Create a dropdown panel that toggles on click. Poll `/api/notifications` every 30s or use **Socket.IO** for real-time push. Show unread count badge on the bell icon. |
| Backend | New module: `notifications/`. Create `POST /api/notifications/mark-read`, `GET /api/notifications`. Generate notifications on events (submission approved/rejected, XP earned, new task in org, new member joined). |
| Database | New `Notification` model: `id`, `userId`, `type` (enum: SUBMISSION_APPROVED, XP_EARNED, NEW_QUEST, etc.), `message`, `isRead`, `createdAt`. |
| Tech | **Socket.IO** for real-time push (best UX), or simple polling with `setInterval` (simpler). |

---

### 1.3 — Settings Gear Icon (User + Org Dashboards)
| | Details |
|---|---|
| **Where** | Both dashboards — ⚙️ icon button in top app bar |
| **Problem** | Static button, no handler. No settings page exists. |
| **What it should do** | Open a user settings panel/page for account management. |
| **How to implement** |
| Frontend | Either a new `settings.html` page or a modal. Sections: Profile (change username, avatar, bio), Security (change password, 2FA), Preferences (theme, notification settings), Account (delete account). |
| Backend | New routes: `PUT /api/user/update-profile` (username, bio, avatar URL), `PUT /api/user/change-password`, `DELETE /api/user/account`. |
| Database | Add fields to `User` model: `bio String?`, `avatarUrl String?` (or use existing `profilePicture`). |

---

### 1.4 — Filter Button on Quest Board
| | Details |
|---|---|
| **Where** | [user-dashboard.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/user-dashboard.html) — "FILTER" button next to "ACTIVE QUESTS" header |
| **Problem** | Static button, no handler. Cannot filter quests. |
| **What it should do** | Open a filter panel to filter quests by: difficulty (Easy/Medium/Hard), visibility (Public/Private/Faction), XP range, deadline, org. |
| **How to implement** |
| Frontend | Toggle a filter drawer/panel below the header. Collect filter values and pass as query params to `/api/tasks/available?difficulty=Hard&min_xp=100`. |
| Backend | Update `getAvailableTasks` in [tasks.service.js](file:///g:/WEB_DEV_n_SHIT/UrQuest/server/src/modules/tasks/tasks.service.js) to accept query params and add Prisma `where` filters. |
| Database | No changes needed — existing fields support filtering. |

---

### 1.5 — XP Status Widget (User Dashboard)
| | Details |
|---|---|
| **Where** | [user-dashboard.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/user-dashboard.html) — XP widget with rank name, progress bar, stats |
| **Problem** | The elements `#xp-rank-name`, `#xp-total-display`, `#xp-next-display`, `#xp-bar-fill`, `#stat-missions`, `#stat-streak` are **never populated by JS**. They show hardcoded text ("ROOKIE", "0", "0 DAYS"). |
| **What it should do** | Show the user's current rank name, XP progress toward next rank, total completed missions, and active streak. |
| **How to implement** |
| Frontend | In `app.loadUserProfile()`, populate these elements using the profile API response. Calculate XP bar width as `(currentXP % xpPerLevel) / xpPerLevel * 100`. Map levels to rank names (e.g., 1-5=ROOKIE, 6-10=OPERATIVE, 11-20=SPECIALIST, etc.). |
| Backend | Update `getUserProfile` in [user.service.js](file:///g:/WEB_DEV_n_SHIT/UrQuest/server/src/modules/user/user.service.js) to return `completed_missions` count (submissions with status APPROVED) and `streak` (consecutive days with approved submissions). |
| Database | For streak tracking, add `lastActiveDate DateTime?` to `User` and `currentStreak Int @default(0)`. Update on each approved submission. |

---

### 1.6 — Sidebar Footer Links ("Factions", "Protocol v1.0")
| | Details |
|---|---|
| **Where** | Both dashboards — bottom of sidebar |
| **Problem** | `<a href="#">` — go nowhere. |
| **What it should do** | "Factions" → a browsable org directory page. "Protocol" → an about/rules/FAQ page. |
| **How to implement** |
| Frontend | Create `factions.html` (org directory with search) and `about.html` (static rules/FAQ page). Link them from the sidebar. |
| Backend | The `/api/orgs/list` endpoint already exists for the factions page. |
| Database | No changes. |

---

### 1.7 — "Decrypt Password?" Link (Login Page)
| | Details |
|---|---|
| **Where** | [index.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/index.html) — "DECRYPT PASSWORD?" link |
| **Problem** | `<a href="#">` — goes nowhere. No password reset flow exists. |
| **What it should do** | Send a password reset email with a token link. |
| **How to implement** |
| Frontend | Open a modal asking for email. Call `POST /api/auth/forgot-password`. Show confirmation. On the reset page, call `POST /api/auth/reset-password` with token + new password. |
| Backend | New routes: `POST /api/auth/forgot-password` (generates a JWT reset token, sends email), `POST /api/auth/reset-password` (validates token, updates password). |
| Database | Add `resetToken String?` and `resetTokenExpiry DateTime?` to `User`, or just use a short-lived JWT. |
| Tech | **Nodemailer** + a transactional email service (Gmail SMTP, SendGrid, or Resend) to send the reset email. |

---

### 1.8 — "Remember Me" Checkbox (Login Page)
| | Details |
|---|---|
| **Where** | [index.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/index.html) — checkbox |
| **Problem** | Purely decorative. The cookie is always set with a 7-day expiry regardless. |
| **What it should do** | If checked → long-lived cookie (7 days). If unchecked → session cookie (expires when browser closes). |
| **How to implement** |
| Frontend | Pass `rememberMe: true/false` in the login POST body. |
| Backend | In `auth.service.js`, if `rememberMe` is false, set the cookie without `maxAge` (making it a session cookie). |
| Database | No changes. |

---

## 🟡 SECTION 2: Existing Features with Gaps

These features partially work but have issues or missing pieces.

---

### 2.1 — Quest Card Design Mismatch
| | Details |
|---|---|
| **Where** | `app.loadAvailableTasks()` in [app.js:577-611](file:///g:/WEB_DEV_n_SHIT/UrQuest/app.js#L577-L611) |
| **Problem** | The JS dynamically creates quest cards using old `cyber-card` class with inline styles. The new HTML has a beautiful `quest-card` design with icons, difficulty badges, XP in lime, and time remaining — but the JS-generated cards don't use any of this. |
| **Fix** | Rewrite `loadAvailableTasks()` to generate cards using the new `.quest-card`, `.quest-icon`, `.quest-title`, `.quest-meta`, `.difficulty-badge` classes from the design system. |

---

### 2.2 — Review Cards Design Mismatch
| | Details |
|---|---|
| **Where** | `app.loadReviews()` in [app.js:217-251](file:///g:/WEB_DEV_n_SHIT/UrQuest/app.js#L217-L251) |
| **Problem** | Same issue — generates old-style `cyber-card` elements. Should use the new glassmorphism panel design. |
| **Fix** | Update the template literals to use new `.glass-panel`, `.btn-3d-primary`, `.btn-danger` classes. |

---

### 2.3 — Leaderboard Row Design
| | Details |
|---|---|
| **Where** | `app.loadLeaderboard()` in [app.js:634-651](file:///g:/WEB_DEV_n_SHIT/UrQuest/app.js#L634-L651) |
| **Problem** | Uses old inline styles. Should use the new `.leaderboard-table` styles and design tokens. |
| **Fix** | Update template literals to use the design system classes and token colors. |

---

### 2.4 — History Cards Design
| | Details |
|---|---|
| **Where** | `app.loadUserProfile()` in [app.js:510-532](file:///g:/WEB_DEV_n_SHIT/UrQuest/app.js#L510-L532) |
| **Problem** | Old inline-styled `cyber-card` for history items. |
| **Fix** | Use `.glass-panel` with `.badge` for status indicators and design system typography. |

---

### 2.5 — Toast Notification Styling
| | Details |
|---|---|
| **Where** | `app.showToast()` in [app.js:11-25](file:///g:/WEB_DEV_n_SHIT/UrQuest/app.js#L11-L25) |
| **Problem** | Uses old `var(--error-color)`, `var(--card-bg)`, `var(--primary-color)`, `var(--font-header)` — these CSS variables **no longer exist** in the new design system. Toasts will appear unstyled (black/transparent). |
| **Fix** | Update to use new tokens: `var(--color-error-container)`, `var(--color-surface-container)`, `var(--color-primary)`, `var(--font-headline)`. |

---

### 2.6 — Org Sidebar Name (Org Dashboard)
| | Details |
|---|---|
| **Where** | [org-dashboard.html](file:///g:/WEB_DEV_n_SHIT/UrQuest/org-dashboard.html) — `#sidebar-org-name` |
| **Problem** | The sidebar shows "ORGANIZATION" but `app.initOrg()` only sets `#org-name-display` (the top bar). The sidebar element `#sidebar-org-name` is never populated. |
| **Fix** | Add `document.getElementById('sidebar-org-name').innerText = app.org.name.toUpperCase();` to `initOrg()`. |

---

### 2.7 — Google OAuth Missing Environment Variables
| | Details |
|---|---|
| **Where** | [passport.js](file:///g:/WEB_DEV_n_SHIT/UrQuest/server/src/config/passport.js) |
| **Problem** | Google OAuth requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. If these aren't set, clicking "Continue with Google" will crash the server. |
| **Fix** | Add a guard: if env vars are missing, disable the Google route and show "Google login unavailable" on the frontend. Or properly configure the Google Cloud Console OAuth credentials. |

---

## 🟢 SECTION 3: New Features to Add

Features that don't exist yet but would significantly enhance the platform.

---

### 3.1 — User Profile Page
| | Details |
|---|---|
| **What** | A dedicated profile page showing avatar, bio, stats, badges, completed quests, org history. Currently there's no way to view your own or other users' profiles. |
| **Frontend** | New `profile.html` page. Sections: Avatar + username, Bio, XP + Level + Rank, Badges grid, Completed quests timeline, Org membership history. |
| **Backend** | `GET /api/user/profile/:userId` (public profile), `PUT /api/user/profile` (edit own). |
| **Database** | Add to `User`: `bio String?`, `avatarUrl String?`, `title String?` (custom title/flair). |
| **Tech** | Image upload for avatars via **Multer** + **Cloudinary** (or just paste a URL for simplicity). |

---

### 3.2 — Achievement / Badge System
| | Details |
|---|---|
| **What** | Unlock badges for milestones: "First Quest", "10 Quests Completed", "100 XP in a Day", "Org Commander", "Streak Master (7 days)", etc. |
| **Frontend** | Badge showcase on profile page + sidebar. Toast popup when unlocked. |
| **Backend** | New module: `badges/`. Logic to check badge conditions after each submission approval. `GET /api/user/badges`, `GET /api/badges/all` (catalog). |
| **Database** | New models: `Badge` (`id`, `name`, `description`, `iconUrl`, `condition`), `UserBadge` (`userId`, `badgeId`, `unlockedAt`). |
| **Tech** | Pure backend logic — check conditions in a post-approval hook. |

---

### 3.3 — Quest Categories / Tags
| | Details |
|---|---|
| **What** | Tag quests with categories: "Development", "Design", "Marketing", "Community", "Bug Fix", etc. Enables filtering and discovery. |
| **Frontend** | Tag chips on quest cards. Category filter in the filter panel. Tag selector in the create quest form. |
| **Backend** | Add `category` field to task creation/listing. |
| **Database** | Add `category String?` to `Task` model. Or for many-to-many: new `Tag` model + `TaskTag` join table. |

---

### 3.4 — Quest Comments / Discussion Thread
| | Details |
|---|---|
| **What** | Allow agents to ask questions or discuss a quest before accepting it. |
| **Frontend** | Expandable comment section on each quest card. Input field + send button. Real-time updates. |
| **Backend** | New module: `comments/`. `POST /api/tasks/:taskId/comments`, `GET /api/tasks/:taskId/comments`. |
| **Database** | New model: `Comment` (`id`, `taskId`, `userId`, `content`, `createdAt`). |
| **Tech** | **Socket.IO** for live comment updates. Or simple polling. |

---

### 3.5 — Quest Status Lifecycle (Accept → In Progress → Submit)
| | Details |
|---|---|
| **What** | Currently quests go directly from "OPEN" to "submitted proof". There's no concept of "accepting" a quest first, tracking progress, or preventing multiple users from working on the same quest. |
| **Frontend** | Quest cards show "ACCEPT QUEST" → status changes to "IN PROGRESS" → "SUBMIT PROOF" button appears. Show "Accepted by X agents" count. |
| **Backend** | New table for quest acceptances. `POST /api/tasks/:id/accept`, `GET /api/tasks/:id/status`. Update task status: OPEN → IN_PROGRESS → COMPLETED. |
| **Database** | New model: `TaskAcceptance` (`id`, `taskId`, `userId`, `acceptedAt`, `status`). Add `maxAcceptances Int?` to `Task` for limiting slots. |

---

### 3.6 — File Upload for Proof Submission
| | Details |
|---|---|
| **What** | Currently proof is just a URL link. Allow users to upload screenshots, PDFs, or files as proof. |
| **Frontend** | Drag-and-drop file upload zone in the submission modal. Preview uploaded files. |
| **Backend** | `POST /api/upload` with multipart form data. Store files and return URLs. |
| **Database** | Change `Submission.proofLink` to support multiple files: add `proofFiles String[]` or a new `SubmissionFile` model. |
| **Tech** | **Multer** for file handling + **Cloudinary** / **AWS S3** / **Supabase Storage** for file storage. |

---

### 3.7 — Org Invite System (Private Orgs)
| | Details |
|---|---|
| **What** | Currently any user can join any org freely. Add invite-only orgs with invite links or invite codes. |
| **Frontend** | "Generate Invite Link" button in org settings. "Enter Invite Code" field in the join flow. Toggle "Open/Invite-Only" in org settings. |
| **Backend** | `POST /api/org/invite/generate` (creates unique code), `POST /api/org/join-by-invite` (validates code). |
| **Database** | Add to `Organization`: `isPrivate Boolean @default(false)`. New model: `OrgInvite` (`id`, `orgId`, `code`, `maxUses`, `usedCount`, `expiresAt`). |

---

### 3.8 — Org Leaderboard & Analytics
| | Details |
|---|---|
| **What** | Organization-specific leaderboard showing which members earn the most XP, complete the most quests. Analytics dashboard for org owners. |
| **Frontend** | New tab in org dashboard: "ANALYTICS". Charts showing: quests completed over time, top performers, XP distribution. |
| **Backend** | `GET /api/org/leaderboard?org_id=X`, `GET /api/org/analytics?org_id=X`. |
| **Database** | No new models needed — aggregate from existing `Submission` + `Task` + `User` data. |
| **Tech** | **Chart.js** or **ApexCharts** for frontend charts. |

---

### 3.9 — Search Functionality
| | Details |
|---|---|
| **What** | No search exists anywhere. Users can't search quests, orgs, or other users. |
| **Frontend** | Search bar in the top app bar. Global search that searches across quests, orgs, and users. |
| **Backend** | `GET /api/search?q=keyword` that searches across tasks (title, description), orgs (name), and users (username). |
| **Database** | Add PostgreSQL full-text search indexes on `Task.title`, `Task.description`, `Organization.name`, `User.username`. |
| **Tech** | Prisma's `contains` filter for basic search. Or PostgreSQL `tsvector`/`tsquery` for advanced full-text search. |

---

### 3.10 — Dark/Light Theme Toggle
| | Details |
|---|---|
| **What** | Currently only dark theme. Add a theme toggle. |
| **Frontend** | Toggle button in settings or top bar. Switch CSS variables between dark and light palettes. Store preference in `localStorage`. |
| **Backend** | Optionally store in user profile so it persists across devices. |
| **Database** | Add `theme String @default("dark")` to `User`. |
| **Tech** | CSS custom properties swap via a `.light-theme` class on `<body>`. |

---

### 3.11 — Quest Deadline Countdown & Expiry
| | Details |
|---|---|
| **What** | Tasks have a `deadline` field in the DB but it's never shown or enforced. |
| **Frontend** | Show countdown timer on quest cards ("2d 14h remaining"). Red warning when <24h. Auto-hide expired quests. |
| **Backend** | Add a cron job or middleware that marks expired tasks as `EXPIRED`. Filter out expired tasks from `/api/tasks/available`. |
| **Database** | No changes — `deadline` field already exists on `Task`. |
| **Tech** | **node-cron** for a background job that runs hourly to expire old tasks. |

---

### 3.12 — Email Notifications
| | Details |
|---|---|
| **What** | Send email notifications for key events: registration confirmation, submission approved/rejected, new quest in your org. |
| **Frontend** | Email preferences in user settings. |
| **Backend** | Email service module. Trigger on events. |
| **Database** | Add to `User`: `emailNotifications Boolean @default(true)`. |
| **Tech** | **Nodemailer** + **SendGrid** / **Resend** / Gmail SMTP. Templates with **Handlebars** or **React Email**. |

---

### 3.13 — Rate Limiting & Security Hardening
| | Details |
|---|---|
| **What** | No rate limiting on login, register, or API endpoints. Vulnerable to brute force and abuse. |
| **Frontend** | Show "Too many attempts" error. Add CAPTCHA on login after 3 failed attempts. |
| **Backend** | Add rate limiting middleware. |
| **Database** | Optionally track failed login attempts: `failedLoginAttempts Int @default(0)`, `lockedUntil DateTime?` on `User`. |
| **Tech** | **express-rate-limit** for API rate limiting. **Google reCAPTCHA v3** for bot protection. |

---

### 3.14 — Mobile Responsive Sidebar (Hamburger Menu)
| | Details |
|---|---|
| **What** | On mobile (<768px), the sidebar is hidden via `display:none` but there's no way to open it. |
| **Frontend** | Add a hamburger menu button in the top app bar (visible only on mobile). Toggle sidebar as an overlay with backdrop. |
| **Backend** | None. |
| **Database** | None. |
| **Tech** | Pure CSS + JS toggle. |

---

### 3.15 — Quest Difficulty-Based XP Multipliers
| | Details |
|---|---|
| **What** | Currently XP is manually set per task. Add automatic multipliers based on difficulty. |
| **Frontend** | Show multiplier on quest cards: "1.5x XP BONUS". Auto-calculate when creating quests. |
| **Backend** | Apply multiplier when approving submissions: Easy=1x, Medium=1.5x, Hard=2x. |
| **Database** | No changes — compute from existing `difficulty` field. |

---

## 📊 Priority Matrix

| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 🔴 Critical | 2.5 — Fix toast styling (broken CSS vars) | 15 min | Toasts are invisible right now |
| 🔴 Critical | 2.1 — Fix quest card rendering | 30 min | Cards use old design |
| 🔴 Critical | 2.2/2.3/2.4 — Fix review/leaderboard/history cards | 30 min | Old design everywhere |
| 🟡 High | 1.1 — Org toggle on login | 30 min | Confusing UX when clicked |
| 🟡 High | 1.5 — XP widget data | 1 hr | Widget shows fake data |
| 🟡 High | 1.8 — Remember me | 15 min | Easy win |
| 🟡 High | 3.5 — Quest accept lifecycle | 3 hrs | Core gamification improvement |
| 🟡 High | 3.14 — Mobile hamburger menu | 1 hr | Unusable on mobile |
| 🟢 Medium | 1.2 — Notifications | 4 hrs | Major UX improvement |
| 🟢 Medium | 1.7 — Password reset | 3 hrs | Essential for real users |
| 🟢 Medium | 3.2 — Badge system | 4 hrs | Core gamification |
| 🟢 Medium | 3.3 — Quest categories | 1 hr | Better discovery |
| 🟢 Medium | 3.9 — Search | 2 hrs | Essential at scale |
| 🟢 Medium | 3.11 — Deadline countdown | 1 hr | Uses existing data |
| 🔵 Nice | 3.1 — Profile page | 3 hrs | Social feature |
| 🔵 Nice | 3.4 — Quest comments | 3 hrs | Collaboration feature |
| 🔵 Nice | 3.6 — File upload | 3 hrs | Better proof system |
| 🔵 Nice | 3.7 — Org invites | 2 hrs | Better org management |
| 🔵 Nice | 3.8 — Org analytics | 3 hrs | Insights for org owners |
| 🔵 Nice | 3.10 — Theme toggle | 2 hrs | Aesthetic preference |
| 🔵 Nice | 3.12 — Email notifications | 3 hrs | Engagement |
| 🔵 Nice | 3.13 — Rate limiting | 1 hr | Security |
| 🔵 Nice | 3.15 — XP multipliers | 30 min | Game balance |

---

> [!IMPORTANT]
> **Start with Section 2 (🔴 Critical fixes)** — the toast styling and card rendering issues mean the new design is partially broken when data loads dynamically. These should be fixed before anything else.

> [!TIP]
> **Biggest bang for effort**: The quest lifecycle (3.5) + badge system (3.2) + XP widget (1.5) would transform this from a basic task board into a real gamified platform. These three features together make the "game loop" feel real.
