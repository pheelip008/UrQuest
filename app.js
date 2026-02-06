const API_BASE_URL = 'http://127.0.0.1:8000';

const app = {
    user: null, // includes .user and .org info locally

    // --- UTILS ---
    showToast: (msg, type='success') => {
        const area = document.getElementById('notification-area');
        if (!area) return;
        const toast = document.createElement('div');
        toast.style.background = type === 'error' ? 'var(--error-color)' : 'var(--card-bg)';
        toast.style.borderLeft = `4px solid ${type === 'error' ? '#fff' : 'var(--primary-color)'}`;
        toast.style.color = '#fff';
        toast.style.padding = '1rem';
        toast.style.marginBottom = '10px';
        toast.style.fontFamily = 'var(--font-header)';
        toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        toast.innerText = msg;
        area.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    request: async (endpoint, method='GET', body=null) => {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);
        
        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'API Error');
            return data;
        } catch (err) {
            app.showToast(err.message, 'error');
            throw err;
        }
    },

    // --- AUTH ---
    login: async () => {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if(!u || !p) return app.showToast('ENTER CREDENTIALS', 'error');

        try {
            const res = await app.request('/auth/login', 'POST', { username: u, password: p });
            localStorage.setItem('urquest_session', JSON.stringify(res)); // Save full auth response {status, user, org}
            app.showToast('ACCESS GRANTED');
            setTimeout(() => window.location.href = 'user-dashboard.html', 1000);
        } catch (e) {}
    },

    register: async () => {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if(!u || !p) return app.showToast('ENTER CREDENTIALS', 'error');

        try {
            await app.request('/auth/register', 'POST', { username: u, password: p });
            app.showToast('REGISTRATION SUCCESS. PLEASE LOGIN.');
        } catch (e) {}
    },

    logout: () => {
        localStorage.removeItem('urquest_session');
        window.location.href = 'index.html';
    },

    getSession: () => {
        const sess = localStorage.getItem('urquest_session');
        if (!sess) return null;
        return JSON.parse(sess);
    },

    // --- ORG FUNCTIONS ---
    initOrg: async () => {
        const session = app.getSession();
        if (!session || !session.org) {
            window.location.href = 'user-dashboard.html'; // Redirect if not org owner
            return;
        }
        
        document.getElementById('org-name-display').innerText = session.org.name.toUpperCase();
        app.user = session.user;
        app.org = session.org;
        
        app.loadOrgStats();
        document.getElementById('create-task-form').addEventListener('submit', app.handleCreateTask);
    },

    switchOrgTab: (tab) => {
        ['dashboard', 'create', 'reviews'].forEach(t => document.getElementById(`view-${t}`).style.display = 'none');
        document.getElementById(`view-${tab}`).style.display = 'block';
        if (tab === 'dashboard') app.loadOrgStats();
        if (tab === 'reviews') app.loadReviews();
    },

    loadOrgStats: async () => {
        try {
            const stats = await app.request(`/org/stats?org_id=${app.org.org_id}`);
            document.getElementById('stat-active-tasks').innerText = stats.active_tasks;
            document.getElementById('stat-pending-reviews').innerText = stats.pending_submissions;
        } catch (e) {}
    },

    handleCreateTask: async (e) => {
        e.preventDefault();
        const data = {
            creator_org_id: app.org.org_id,
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            xp_reward: parseInt(document.getElementById('task-xp').value),
            difficulty: document.getElementById('task-diff').value,
            deadline: document.getElementById('task-deadline').value || null 
        };
        if (!data.deadline) delete data.deadline; 

        try {
            await app.request('/tasks/create', 'POST', data);
            app.showToast('TASK DEPLOYED SUCCESSFULLY');
            document.getElementById('create-task-form').reset();
            app.switchOrgTab('dashboard');
        } catch (e) {}
    },

    loadReviews: async () => {
        const container = document.getElementById('reviews-list');
        container.innerHTML = '<div style="text-align:center">SCANNING...</div>';
        try {
            const reviews = await app.request(`/org/reviews?org_id=${app.org.org_id}`);
            container.innerHTML = '';
            if (reviews.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#555;">NO PENDING TRANSMISSIONS</div>';
                return;
            }
            reviews.forEach(sub => {
                const card = document.createElement('div');
                card.className = 'cyber-card';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h3 style="color:#fff; margin-bottom:5px;">${sub.task_title}</h3>
                            <div style="color:var(--primary-color)">AGENT: ${sub.student_name}</div>
                            <div style="margin:10px 0;">
                                <a href="${sub.proof_link}" target="_blank" style="color:var(--accent-color);">[VIEW PROOF DATA]</a>
                            </div>
                        </div>
                        <div style="text-align:right">
                            <div class="badge Hard">+${sub.xp_reward} XP</div>
                        </div>
                    </div>
                    <div style="margin-top:1rem; display:flex; gap:10px;">
                        <button class="cyber-btn" onclick="app.submitReview(${sub.submission_id}, 'APPROVE')">APPROVE</button>
                        <button class="cyber-btn danger" onclick="app.submitReview(${sub.submission_id}, 'REJECT')">REJECT</button>
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (e) {}
    },

    submitReview: async (id, action) => {
        try {
            await app.request('/submissions/review', 'POST', {
                submission_id: id,
                action: action,
                feedback: action === 'APPROVE' ? 'Excellent work' : 'Insufficient data'
            });
            app.showToast(`SUBMISSION ${action}D`);
            app.loadReviews();
        } catch (e) {}
    },

    // --- USER FUNCTIONS ---
    initUser: async () => {
        const session = app.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        app.session = session;
        document.getElementById('username-display').innerText = session.user.username.toUpperCase();
        
        // Update Org UI
        if (session.org) {
            document.getElementById('org-none-ui').style.display = 'none';
            document.getElementById('org-exists-ui').style.display = 'block';
            document.getElementById('my-org-name').innerText = session.org.name;
        } else {
            document.getElementById('org-none-ui').style.display = 'block';
            document.getElementById('org-exists-ui').style.display = 'none';
        }

        await app.loadUserProfile();
        app.loadAvailableTasks();
    },

    showCreateOrgModal: () => {
        document.getElementById('create-org-modal').style.display = 'flex';
    },

    createOrg: async () => {
        const name = document.getElementById('new-org-name').value;
        if (!name) return app.showToast('NAME REQUIRED', 'error');

        try {
            const res = await app.request('/org/create', 'POST', {
                owner_user_id: app.session.user.user_id,
                name: name
            });
            
            // Update local session
            app.session.org = { org_id: res.org_id, name: res.name };
            localStorage.setItem('urquest_session', JSON.stringify(app.session));
            
            app.showToast('ORGANIZATION ESTABLISHED');
            document.getElementById('create-org-modal').style.display = 'none';
            
            // Refresh UI
            app.initUser();
            
        } catch (e) {}
    },

    loadUserProfile: async () => {
        try {
            const profile = await app.request(`/user/profile?user_id=${app.session.user.user_id}`);
            document.getElementById('user-level').innerText = `LVL ${profile.level}`;
            document.getElementById('user-xp').innerText = `${profile.total_xp} XP`;
            document.getElementById('user-rank-display').innerText = `#${profile.rank}`;
            
            const histList = document.getElementById('history-list');
            histList.innerHTML = '';
            profile.history.forEach(h => {
                const item = document.createElement('div');
                item.className = 'cyber-card';
                item.style.padding = '10px';
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span>${h.title}</span>
                        <span class="status-${h.status}">${h.status}</span>
                    </div>
                `;
                histList.appendChild(item);
            });
        } catch (e) {}
    },

    switchUserTab: (tab) => {
        ['quests', 'leaderboard', 'profile'].forEach(t => document.getElementById(`tab-${t}`).style.display = 'none');
        document.getElementById(`tab-${tab}`).style.display = 'block';
        if (tab === 'quests') app.loadAvailableTasks();
        if (tab === 'leaderboard') app.loadLeaderboard();
        if (tab === 'profile') app.loadUserProfile();
    },

    loadAvailableTasks: async () => {
        const grid = document.getElementById('quest-grid');
        grid.innerHTML = 'LOADING...';
        try {
            const tasks = await app.request('/tasks/available');
            grid.innerHTML = '';
            if (tasks.length === 0) {
                grid.innerHTML = 'NO MISSIONS DETECTED.';
                return;
            }
            tasks.forEach(task => {
                const card = document.createElement('div');
                card.className = 'cyber-card';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span class="badge ${task.difficulty}">${task.difficulty}</span>
                        <span style="color:var(--primary-color)">${task.xp_reward} XP</span>
                    </div>
                    <div style="font-size:0.7rem; color:#888; margin-top:5px;">${task.org_name}</div>
                    <h3 style="margin:5px 0; color:#fff;">${task.title}</h3>
                    <p style="color:#aaa; font-size:0.9rem; margin-bottom:1rem;">${task.description}</p>
                    <button class="cyber-btn" style="width:100%" onclick="app.openSubmitModal(${task.task_id})">ACCEPT & SUBMIT</button>
                `;
                grid.appendChild(card);
            });
        } catch (e) {}
    },

    openSubmitModal: (taskId) => {
        document.getElementById('modal-task-id').value = taskId;
        document.getElementById('submission-modal').style.display = 'flex';
    },

    submitProof: async () => {
        const taskId = document.getElementById('modal-task-id').value;
        const proof = document.getElementById('proof-link').value;
        if (!proof) return app.showToast('PROOF LINK REQUIRED', 'error');

        try {
            await app.request('/tasks/submit', 'POST', {
                task_id: parseInt(taskId),
                user_id: app.session.user.user_id,
                proof_link: proof
            });
            app.showToast('MISSION DATA UPLOADED');
            document.getElementById('submission-modal').style.display = 'none';
        } catch (e) {}
    },

    loadLeaderboard: async () => {
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '<tr><td>Scanning...</td></tr>';
        try {
            const data = await app.request('/leaderboard');
            tbody.innerHTML = '';
            data.forEach((u, i) => {
                const row = `
                    <tr style="border-bottom:1px solid #222;">
                        <td style="color:${i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'#888'}">#${i+1}</td>
                        <td style="font-weight:bold; color:#fff;">${u.username}</td>
                        <td style="color:var(--primary-color)">${u.total_xp} XP</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } catch (e) {}
    }
};
