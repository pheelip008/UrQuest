const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') 
    // Keep the local API host aligned with the OAuth callback so its session cookie is sent.
    ? 'http://localhost:8080'
    : 'https://urquest-api.onrender.com'; 

const app = {
    user: null, 
    session: null,
    org: null,
    notificationInterval: null,
    activeFilters: {},

    // --- UTILS ---
    showToast: (msg, type='success') => {
        const area = document.getElementById('notification-area');
        if (!area) return;
        const toast = document.createElement('div');
        toast.style.background = type === 'error' ? 'var(--color-error-container)' : 'var(--color-surface-container)';
        toast.style.borderLeft = `4px solid ${type === 'error' ? 'var(--color-error)' : 'var(--color-primary)'}`;
        toast.style.color = '#fff';
        toast.style.padding = '1rem';
        toast.style.marginBottom = '10px';
        toast.style.fontFamily = 'var(--font-headline)';
        toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        toast.style.borderRadius = '8px';
        toast.style.animation = 'fadeIn 0.3s ease';
        toast.innerText = msg;
        area.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    request: async (endpoint, method='GET', body=null) => {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        };
        if (body) options.body = JSON.stringify(body);
        
        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.message || 'API Error');
            return data;
        } catch (err) {
            app.showToast(err.message, 'error');
            throw err;
        }
    },

    // --- AUTH ---
    currentRole: 'user',
    setRole: (role) => {
        app.currentRole = role;
    },

    login: async () => {
        const email = document.getElementById('email').value;
        const p = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me')?.checked || false;
        if(!email || !p) return app.showToast('ENTER CREDENTIALS', 'error');

        try {
            const res = await app.request('/api/auth/login', 'POST', { email, password: p, rememberMe });
            app.showToast('ACCESS GRANTED');
            setTimeout(() => {
                if (app.currentRole === 'org') {
                    window.location.href = 'org-dashboard.html';
                } else {
                    window.location.href = 'user-dashboard.html';
                }
            }, 1000);
        } catch (e) {}
    },

    register: async () => {
        const username = document.getElementById('username').value;
        const email = document.getElementById('reg-email').value;
        const p = document.getElementById('reg-password').value;
        if(!username || !email || !p) return app.showToast('ALL FIELDS REQUIRED', 'error');

        try {
            await app.request('/api/auth/register', 'POST', { username, email, password: p });
            app.showToast('REGISTRATION SUCCESS. PLEASE LOGIN.');
            app.showLoginForm();
        } catch (e) {}
    },

    handleGoogleLogin: () => {
        window.location.href = `${API_BASE_URL}/auth/google`;
    },

    logout: async () => {
        if (app.notificationInterval) clearInterval(app.notificationInterval);
        try {
            await app.request('/api/auth/logout', 'POST');
        } catch (e) {}
        window.location.href = 'index.html';
    },

    getSession: async () => {
        try {
            const data = await app.request('/api/auth/me');
            if (data.success) return data;
            return null;
        } catch (e) {
            return null;
        }
    },

    showLoginForm: () => {
        const loginUI = document.getElementById('login-ui');
        const registerUI = document.getElementById('register-ui');
        if (loginUI) loginUI.style.display = 'block';
        if (registerUI) registerUI.style.display = 'none';
    },

    showRegisterForm: () => {
        const loginUI = document.getElementById('login-ui');
        const registerUI = document.getElementById('register-ui');
        if (loginUI) loginUI.style.display = 'none';
        if (registerUI) registerUI.style.display = 'block';
    },

    // --- THEME TOGGLE ---
    toggleTheme: () => {
        const html = document.documentElement;
        const isLight = html.classList.toggle('light-theme');
        localStorage.setItem('urquest-theme', isLight ? 'light' : 'dark');
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) icon.innerText = isLight ? 'dark_mode' : 'light_mode';
    },

    initTheme: () => {
        const saved = localStorage.getItem('urquest-theme');
        if (saved === 'light') {
            document.documentElement.classList.add('light-theme');
            const icon = document.getElementById('theme-toggle-icon');
            if (icon) icon.innerText = 'dark_mode';
        }
    },

    // --- NOTIFICATIONS ---
    initNotifications: () => {
        app.pollNotifications();
        app.notificationInterval = setInterval(app.pollNotifications, 30000);
    },

    pollNotifications: async () => {
        try {
            const data = await app.request('/api/notifications/count');
            const badge = document.getElementById('notif-badge');
            if (badge) {
                if (data.count > 0) {
                    badge.style.display = 'flex';
                    badge.innerText = data.count > 9 ? '9+' : data.count;
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (e) {}
    },

    toggleNotifDropdown: async () => {
        const dropdown = document.getElementById('notif-dropdown');
        if (!dropdown) return;
        
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            try {
                const notes = await app.request('/api/notifications');
                const list = document.getElementById('notif-list');
                if (notes.length === 0) {
                    list.innerHTML = '<div style="padding:16px; text-align:center; color:var(--color-outline-variant); font-size:12px; font-family:var(--font-label);">NO TRANSMISSIONS</div>';
                } else {
                    list.innerHTML = notes.map(n => `
                        <div style="padding:12px 16px; border-bottom:1px solid var(--color-surface-container-high); ${n.is_read ? 'opacity:0.6;' : ''}">
                            <div style="font-family:var(--font-body); font-size:13px; color:var(--color-on-surface); line-height:1.4;">${n.message}</div>
                            <div style="font-family:var(--font-label); font-size:10px; color:var(--color-outline-variant); margin-top:4px; letter-spacing:0.1em;">${new Date(n.created_at).toLocaleString()}</div>
                        </div>
                    `).join('');
                }
                await app.request('/api/notifications/read', 'POST');
                app.pollNotifications();
            } catch (e) {}
        }
    },

    // --- SEARCH ---
    initSearch: () => {
        const input = document.getElementById('search-input');
        if (!input) return;
        
        let debounceTimer;
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => app.performSearch(input.value), 300);
        });
        
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('search-dropdown');
            const searchWrap = document.getElementById('search-wrap');
            if (dropdown && searchWrap && !searchWrap.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    },

    performSearch: async (query) => {
        const dropdown = document.getElementById('search-dropdown');
        if (!dropdown) return;
        
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }
        
        try {
            const results = await app.request(`/api/search?q=${encodeURIComponent(query)}`);
            let html = '';
            
            if (results.quests.length > 0) {
                html += '<div style="padding:8px 16px; font-family:var(--font-label); font-size:10px; color:var(--color-primary); letter-spacing:0.1em;">QUESTS</div>';
                results.quests.forEach(q => {
                    html += `<a href="#" onclick="app.switchUserTab('quests'); document.getElementById('search-dropdown').style.display='none'; return false;" style="display:block; padding:10px 16px; color:var(--color-on-surface); font-size:13px; text-decoration:none; border-bottom:1px solid var(--color-surface-container-high);">
                        <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:6px;">data_object</span>
                        ${q.title} <span style="color:var(--color-primary-fixed-dim); font-size:11px;">+${q.xp_reward} XP</span>
                    </a>`;
                });
            }
            
            if (results.orgs.length > 0) {
                html += '<div style="padding:8px 16px; font-family:var(--font-label); font-size:10px; color:var(--color-secondary); letter-spacing:0.1em;">ORGANIZATIONS</div>';
                results.orgs.forEach(o => {
                    html += `<a href="#" onclick="app.viewOrgProfile(${o.org_id}); document.getElementById('search-dropdown').style.display='none'; return false;" style="display:block; padding:10px 16px; color:var(--color-on-surface); font-size:13px; text-decoration:none; border-bottom:1px solid var(--color-surface-container-high);">
                        <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:6px;">group</span>
                        ${o.name}
                    </a>`;
                });
            }
            
            if (results.users.length > 0) {
                html += '<div style="padding:8px 16px; font-family:var(--font-label); font-size:10px; color:var(--color-tertiary-container); letter-spacing:0.1em;">AGENTS</div>';
                results.users.forEach(u => {
                    html += `<a href="profile.html?id=${u.user_id}" style="display:block; padding:10px 16px; color:var(--color-on-surface); font-size:13px; text-decoration:none; border-bottom:1px solid var(--color-surface-container-high);">
                        <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:6px;">person</span>
                        ${u.username} <span style="color:var(--color-outline-variant); font-size:11px;">${u.total_xp} XP</span>
                    </a>`;
                });
            }
            
            if (html === '') {
                html = '<div style="padding:16px; text-align:center; color:var(--color-outline-variant); font-size:12px;">NO RESULTS FOUND</div>';
            }
            
            dropdown.innerHTML = html;
            dropdown.style.display = 'block';
        } catch (e) {}
    },

    // --- SETTINGS MODAL ---
    openSettings: () => {
        document.getElementById('settings-modal').style.display = 'flex';
        const usernameInput = document.getElementById('settings-username');
        const bioInput = document.getElementById('settings-bio');
        if (usernameInput && app.session) usernameInput.value = app.session.user.username;
        if (bioInput) bioInput.value = '';
    },

    saveProfile: async () => {
        const username = document.getElementById('settings-username')?.value;
        const bio = document.getElementById('settings-bio')?.value;
        try {
            await app.request('/api/user/update-profile', 'PUT', { username, bio });
            app.showToast('PROFILE UPDATED');
            if (app.session) app.session.user.username = username;
            const display = document.getElementById('username-display');
            if (display) display.innerText = username.toUpperCase();
        } catch (e) {}
    },

    changePassword: async () => {
        const current = document.getElementById('settings-current-pw')?.value;
        const newPw = document.getElementById('settings-new-pw')?.value;
        if (!current || !newPw) return app.showToast('FILL ALL FIELDS', 'error');
        if (newPw.length < 6) return app.showToast('PASSWORD TOO SHORT (MIN 6)', 'error');
        try {
            await app.request('/api/user/change-password', 'PUT', { current_password: current, new_password: newPw });
            app.showToast('ACCESS CODE CHANGED');
            document.getElementById('settings-current-pw').value = '';
            document.getElementById('settings-new-pw').value = '';
        } catch (e) {}
    },

    // --- FILTER DRAWER ---
    toggleFilterDrawer: () => {
        const drawer = document.getElementById('filter-drawer');
        if (!drawer) return;
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    },

    applyFilters: () => {
        const difficulty = document.getElementById('filter-difficulty')?.value || '';
        const category = document.getElementById('filter-category')?.value || '';
        const minXp = document.getElementById('filter-min-xp')?.value || '';
        const maxXp = document.getElementById('filter-max-xp')?.value || '';
        const sortBy = document.getElementById('filter-sort')?.value || '';
        
        app.activeFilters = {};
        if (difficulty) app.activeFilters.difficulty = difficulty;
        if (category) app.activeFilters.category = category;
        if (minXp) app.activeFilters.min_xp = minXp;
        if (maxXp) app.activeFilters.max_xp = maxXp;
        if (sortBy) app.activeFilters.sort_by = sortBy;
        
        app.loadAvailableTasks();
        app.toggleFilterDrawer();
    },

    clearFilters: () => {
        app.activeFilters = {};
        const ids = ['filter-difficulty', 'filter-category', 'filter-min-xp', 'filter-max-xp', 'filter-sort'];
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        app.loadAvailableTasks();
        app.toggleFilterDrawer();
    },

    // --- DEADLINE COUNTDOWN ---
    getCountdown: (deadlineStr) => {
        if (!deadlineStr) return null;
        const deadline = new Date(deadlineStr);
        const now = new Date();
        const diff = deadline - now;
        if (diff <= 0) return 'EXPIRED';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) return `${days}D ${hours}H`;
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}H ${mins}M`;
    },

    // --- COMMENTS ---
    toggleComments: async (taskId) => {
        const container = document.getElementById(`comments-${taskId}`);
        if (!container) return;
        
        if (container.style.display === 'block') {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        container.innerHTML = '<div style="text-align:center; color:var(--color-outline-variant); font-size:11px; padding:8px;">LOADING...</div>';
        
        try {
            const comments = await app.request(`/api/tasks/${taskId}/comments`);
            let html = '';
            if (comments.length > 0) {
                html = comments.map(c => `
                    <div style="padding:8px 0; border-bottom:1px solid var(--color-surface-container-high);">
                        <span style="color:var(--color-primary); font-family:var(--font-label); font-size:11px; font-weight:700;">${c.user}</span>
                        <span style="color:var(--color-outline-variant); font-size:10px; margin-left:8px;">${new Date(c.created_at).toLocaleString()}</span>
                        <div style="color:var(--color-on-surface); font-size:13px; margin-top:4px; line-height:1.4;">${c.content}</div>
                    </div>
                `).join('');
            } else {
                html = '<div style="color:var(--color-outline-variant); font-size:11px; padding:4px 0;">NO COMMENTS YET</div>';
            }
            html += `
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <input type="text" id="comment-input-${taskId}" class="cyber-input" placeholder="ADD COMMENT..." style="flex:1; padding:8px 12px; font-size:12px;">
                    <button class="btn-3d-primary" onclick="app.addComment(${taskId})" style="padding:8px 16px; font-size:11px;">SEND</button>
                </div>
            `;
            container.innerHTML = html;
        } catch (e) {}
    },

    addComment: async (taskId) => {
        const input = document.getElementById(`comment-input-${taskId}`);
        if (!input || !input.value.trim()) return app.showToast('EMPTY COMMENT', 'error');
        try {
            await app.request(`/api/tasks/${taskId}/comments`, 'POST', { content: input.value.trim() });
            app.showToast('COMMENT POSTED');
            app.toggleComments(taskId);
            app.toggleComments(taskId);
        } catch (e) {}
    },

    // --- ORG FUNCTIONS ---
    initOrg: async () => {
        app.initTheme();
        const session = await app.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        if (!session.owned_org) { 
             if (!session.user.can_create_task) {
                 window.location.href = 'user-dashboard.html';
                 return;
             }
             app.org = session.member_org;
        } else {
             app.org = session.owned_org;
        }

        app.user = session.user;
        app.session = session;
        document.getElementById('org-name-display').innerText = app.org.name.toUpperCase();
        
        const sidebarOrgName = document.getElementById('sidebar-org-name');
        if (sidebarOrgName) sidebarOrgName.innerText = app.org.name.toUpperCase();
        
        app.loadOrgStats();
        app.initNotifications();
        app.initSearch();
        
        const createTaskForm = document.getElementById('create-task-form');
        if(createTaskForm) createTaskForm.addEventListener('submit', app.handleCreateOrgTask);
        
        const createRoleForm = document.getElementById('create-role-form');
        if(createRoleForm) createRoleForm.addEventListener('submit', app.handleCreateRole);

        const editOrgForm = document.getElementById('edit-org-form');
        if(editOrgForm) editOrgForm.addEventListener('submit', app.handleEditOrg);
    },

    switchOrgTab: (tab) => {
        ['dashboard', 'create', 'reviews', 'settings', 'analytics'].forEach(t => {
            const el = document.getElementById(`view-${t}`);
             if(el) el.style.display = 'none';
        });
        const target = document.getElementById(`view-${tab}`);
        if(target) target.style.display = 'block';
        
        if (tab === 'dashboard') app.loadOrgStats();
        if (tab === 'create') app.loadOrgMembersForAssignAndCreate();
        if (tab === 'reviews') app.loadReviews();
        if (tab === 'settings') {
            app.loadRoles();
            app.loadMembers();
            app.populateOrgEditForm();
            app.loadInvites();
        }
        if (tab === 'analytics') app.loadOrgAnalytics();
    },

    loadOrgStats: async () => {
        try {
            const stats = await app.request(`/api/org/stats?org_id=${app.org.org_id}`);
            document.getElementById('stat-active-tasks').innerText = stats.active_tasks;
            document.getElementById('stat-pending-reviews').innerText = stats.pending_submissions;
        } catch (e) {}
    },

    loadOrgMembersForAssignAndCreate: async () => {
        const select = document.getElementById('task-assignees');
        if(!select) return;
        try {
            const members = await app.request(`/api/org/members?org_id=${app.org.org_id}`);
            select.innerHTML = '';
            members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.user_id;
                opt.innerText = `${m.username} (${m.role_name || 'Member'})`;
                select.appendChild(opt);
            });
        } catch(e) {}
    },

    handleCreateOrgTask: async (e) => {
        e.preventDefault();
        
        const visibility = document.querySelector('input[name="visibility"]:checked').value;
        let assigneeIds = [];
        
        if(visibility === 'PRIVATE') {
             const select = document.getElementById('task-assignees');
             assigneeIds = Array.from(select.selectedOptions).map(opt => opt.value);
        }

        const data = {
            org_id: app.org.org_id,
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            xp_reward: parseInt(document.getElementById('task-xp').value),
            difficulty: document.getElementById('task-diff').value,
            category: document.getElementById('task-category')?.value || null,
            deadline: document.getElementById('task-deadline').value || null,
            visibility: visibility,
            assignee_ids: assigneeIds
        };
        try {
            await app.request('/api/tasks/create', 'POST', data);
            app.showToast('TASK DEPLOYED SUCCESSFULLY');
            document.getElementById('create-task-form').reset();
            app.switchOrgTab('dashboard');
        } catch (e) {}
    },

    loadReviews: async () => {
        const container = document.getElementById('reviews-list');
        if (!container) return;
        container.innerHTML = '<div style="text-align:center">SCANNING...</div>';
        try {
            const [acceptanceRequests, reviews] = await Promise.all([
                app.request('/api/tasks/acceptance-requests'),
                app.request(`/api/org/reviews?org_id=${app.org.org_id}`)
            ]);
            container.innerHTML = '';
            if (acceptanceRequests.length === 0 && reviews.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#555;">NO PENDING TRANSMISSIONS</div>';
                return;
            }
            acceptanceRequests.forEach(request => {
                const card = document.createElement('div');
                card.className = 'glass-panel';
                card.style.padding = 'var(--margin-mobile)';
                card.style.marginBottom = '16px';
                card.style.borderRadius = '12px';
                card.innerHTML = `
                    <div style="color:var(--color-tertiary-container); font-family:var(--font-label); font-size:11px; letter-spacing:0.1em; margin-bottom:8px;">ACCEPTANCE REQUEST</div>
                    <h3 style="color:var(--color-on-surface); margin-bottom:5px; font-family:var(--font-headline); font-size:18px;">${request.task_title}</h3>
                    <div style="color:var(--color-primary); font-family:var(--font-body); font-size:14px;">AGENT: ${request.agent_name}</div>
                    <div style="margin-top:1rem; display:flex; gap:10px;">
                        <button class="btn-3d-primary" style="flex:1" onclick="app.reviewAcceptance(${request.acceptance_id}, 'APPROVE')">APPROVE AGENT</button>
                        <button class="btn-danger" style="flex:1" onclick="app.reviewAcceptance(${request.acceptance_id}, 'REJECT')">REJECT AGENT</button>
                    </div>
                `;
                container.appendChild(card);
            });
            reviews.forEach(sub => {
                const card = document.createElement('div');
                card.className = 'glass-panel';
                card.style.padding = 'var(--margin-mobile)';
                card.style.marginBottom = '16px';
                card.style.borderRadius = '12px';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h3 style="color:var(--color-on-surface); margin-bottom:5px; font-family:var(--font-headline); font-size:18px;">${sub.task_title}</h3>
                            <div style="color:var(--color-primary); font-family:var(--font-body); font-size:14px;">AGENT: ${sub.student_name}</div>
                            <div style="margin:10px 0;">
                                <a href="${sub.proof_link}" target="_blank" style="color:var(--color-secondary); font-family:var(--font-label); font-size:12px;">[VIEW PROOF DATA]</a>
                            </div>
                        </div>
                        <div style="text-align:right">
                            <div class="difficulty-badge Hard">+${sub.xp_reward} XP</div>
                        </div>
                    </div>
                    <div style="margin-top:1rem; display:flex; gap:10px;">
                        <button class="btn-3d-primary" style="flex:1" onclick="app.submitReview(${sub.submission_id}, 'APPROVE')">APPROVE</button>
                        <button class="btn-danger" style="flex:1" onclick="app.submitReview(${sub.submission_id}, 'REJECT')">REJECT</button>
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (e) {}
    },

    submitReview: async (id, action) => {
        try {
            await app.request('/api/submissions/review', 'POST', {
                submission_id: id,
                action: action,
                feedback: action === 'APPROVE' ? 'Excellent work' : 'Insufficient data'
            });
            app.showToast(`SUBMISSION ${action}D`);
            app.loadReviews();
        } catch (e) {}
    },

    reviewAcceptance: async (id, action) => {
        try {
            await app.request('/api/tasks/acceptance-requests/review', 'POST', {
                acceptance_id: id,
                action: action
            });
            app.showToast(`AGENT ${action}D`);
            app.loadReviews();
            app.loadProjectRequests();
            app.loadProjects();
        } catch (e) {}
    },
    
    // --- ADVANCED ORG FEATURES ---
    
    handleCreateRole: async (e) => {
        e.preventDefault();
        try {
            await app.request('/api/org/roles/create', 'POST', {
                org_id: app.org.org_id,
                name: document.getElementById('role-name').value,
                rank: parseInt(document.getElementById('role-rank').value),
                can_create_task: document.getElementById('role-perm-create').checked
            });
            app.showToast('ROLE DEFINITION CREATED');
            document.getElementById('create-role-form').reset();
            app.loadRoles();
        } catch(e) {}
    },
    
    loadRoles: async () => {
        const el = document.getElementById('roles-list-display');
        try {
            const roles = await app.request(`/api/org/roles?org_id=${app.org.org_id}`);
            el.innerHTML = roles.map(r => `
                <div style="border-bottom:1px solid #333; padding:5px; display:flex; justify-content:space-between;">
                    <span style="color:${r.can_create_task ? 'var(--color-primary)' : '#fff'}">${r.name} (Lvl ${r.rank})</span>
                    ${r.can_create_task ? '<span style="font-size:0.7rem;">[COMMAND]</span>' : ''}
                </div>
            `).join('');
        } catch(e) {}
    },
    
    loadMembers: async () => {
        const tbody = document.getElementById('members-table-body');
        try {
            const members = await app.request(`/api/org/members?org_id=${app.org.org_id}`);
            const roles = await app.request(`/api/org/roles?org_id=${app.org.org_id}`);
            
            tbody.innerHTML = members.map(m => `
                <tr>
                    <td>${m.username}</td>
                    <td>${m.role_name || 'NO RANK'}</td>
                    <td>
                        <select onchange="app.assignRole('${m.user_id}', this.value)" style="background:#000; color:#fff; border:1px solid #333;">
                            <option value="">-- ASSIGN --</option>
                            ${roles.map(r => `<option value="${r.role_id}">${r.name}</option>`).join('')}
                        </select>
                    </td>
                </tr>
            `).join('');
        } catch(e) {}
    },
    
    assignRole: async (targetId, roleId) => {
        if(!roleId) return;
        try {
            await app.request('/api/org/roles/assign', 'POST', {
                target_user_id: targetId,
                role_id: parseInt(roleId)
            });
            app.showToast('RANK ASSIGNED');
            app.loadMembers();
        } catch(e) {}
    },
    
    populateOrgEditForm: () => {
        document.getElementById('edit-org-name').value = app.org.name;
        document.getElementById('edit-org-desc').value = app.org.description || '';
        document.getElementById('edit-org-img').value = app.org.image_url || '';
    },
    
    handleEditOrg: async (e) => {
        e.preventDefault();
        try {
            await app.request('/api/org/update', 'POST', {
                org_id: app.org.org_id,
                name: document.getElementById('edit-org-name').value,
                description: document.getElementById('edit-org-desc').value,
                image_url: document.getElementById('edit-org-img').value
            });
            app.showToast('IDENTITY UPDATED');
            app.org.name = document.getElementById('edit-org-name').value;
            app.org.description = document.getElementById('edit-org-desc').value;
            app.org.image_url = document.getElementById('edit-org-img').value;
            document.getElementById('org-name-display').innerText = app.org.name.toUpperCase();
        } catch(e) {}
    },
    
    initiateTransfer: () => {
        const target = document.getElementById('transfer-target-id').value;
        if(!target) return app.showToast('TARGET AGENT ID REQUIRED', 'error');
        app.transferTargetId = target;
        document.getElementById('transfer-modal').style.display = 'flex';
    },
    
    confirmTransfer: async () => {
        const pw = document.getElementById('transfer-password').value;
        if(!pw) return app.showToast('PASSWORD REQUIRED', 'error');
        try {
            await app.request('/api/org/transfer-ownership', 'POST', {
                password: pw,
                new_owner_id: app.transferTargetId,
                org_id: app.org.org_id
            });
            app.showToast('COMMAND TRANSFERRED. LOGGING OUT...', 'success');
            setTimeout(() => { app.logout(); }, 2000);
        } catch(e) {}
    },

    // --- ORG INVITES ---
    createInvite: async () => {
        try {
            const res = await app.request('/api/org/invite/create', 'POST', { org_id: app.org.org_id });
            app.showToast(`INVITE CODE: ${res.invite_code}`);
            app.loadInvites();
        } catch (e) {}
    },

    loadInvites: async () => {
        const container = document.getElementById('invites-list');
        if (!container) return;
        try {
            const invites = await app.request(`/api/org/invites?org_id=${app.org.org_id}`);
            if (invites.length === 0) {
                container.innerHTML = '<div style="color:var(--color-outline-variant); font-size:12px;">NO ACTIVE INVITES</div>';
                return;
            }
            container.innerHTML = invites.map(i => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid var(--color-surface-container-high);">
                    <div>
                        <span style="color:var(--color-primary); font-family:var(--font-body); font-size:14px; font-weight:700;">${i.invite_code}</span>
                        <span style="color:var(--color-outline-variant); font-size:11px; margin-left:8px;">USES: ${i.uses}${i.max_uses ? '/' + i.max_uses : '/∞'}</span>
                    </div>
                    <button class="btn-ghost" style="padding:4px 12px; font-size:10px;" onclick="navigator.clipboard.writeText('${i.invite_code}'); app.showToast('COPIED!');">COPY</button>
                </div>
            `).join('');
        } catch (e) {}
    },

    // --- ORG ANALYTICS ---
    loadOrgAnalytics: async () => {
        try {
            const [analytics, leaderboard] = await Promise.all([
                app.request(`/api/org/analytics?org_id=${app.org.org_id}`),
                app.request(`/api/org/leaderboard?org_id=${app.org.org_id}`)
            ]);
            
            const el = (id) => document.getElementById(id);
            if (el('analytics-members')) el('analytics-members').innerText = analytics.member_count;
            if (el('analytics-tasks')) el('analytics-tasks').innerText = analytics.total_tasks;
            if (el('analytics-submissions')) el('analytics-submissions').innerText = analytics.total_submissions;
            if (el('analytics-approved')) el('analytics-approved').innerText = analytics.approved;
            if (el('analytics-rejected')) el('analytics-rejected').innerText = analytics.rejected;
            if (el('analytics-pending')) el('analytics-pending').innerText = analytics.pending;
            if (el('analytics-xp')) el('analytics-xp').innerText = analytics.total_xp_distributed;
            
            const tbody = document.getElementById('org-leaderboard-body');
            if (tbody) {
                tbody.innerHTML = leaderboard.map((m, i) => `
                    <tr style="border-bottom:1px solid var(--color-surface-container-high);">
                        <td style="color:${i===0?'var(--color-primary)':i===1?'var(--color-primary-fixed-dim)':i===2?'var(--color-outline)':'var(--color-outline-variant)'}; padding:12px 0;">#${i+1}</td>
                        <td style="font-family:var(--font-headline); font-weight:600; color:var(--color-on-surface); padding:12px 0;">${m.username}</td>
                        <td style="color:var(--color-outline-variant); font-size:12px; padding:12px 0;">${m.role_name || 'AGENT'}</td>
                        <td style="color:var(--color-tertiary-container); font-family:var(--font-stat); padding:12px 0;">${m.total_xp} XP</td>
                    </tr>
                `).join('');
            }
        } catch (e) {}
    },

    // --- USER FUNCTIONS ---
    initUser: async () => {
        app.initTheme();
        const session = await app.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        app.session = session;
        app.user = session.user;
        document.getElementById('username-display').innerText = session.user.username.toUpperCase();
        
        const ptForm = document.getElementById('create-public-task-form');
         if(ptForm) {
            const newForm = ptForm.cloneNode(true);
            ptForm.parentNode.replaceChild(newForm, ptForm);
            newForm.addEventListener('submit', app.handleCreatePublicTask);
        }
        
        const memberOrg = session.member_org;
        const ownedOrg = session.owned_org;

        if (memberOrg) {
            document.getElementById('org-none-ui').style.display = 'none';
            document.getElementById('org-exists-ui').style.display = 'block';
            document.getElementById('my-org-name').innerText = memberOrg.name;
            
            let userRoleStr = session.user.role_name || 'AGENT';
            let badgeClass = 'badge';
            
            if (ownedOrg && ownedOrg.org_id === memberOrg.org_id) {
                 userRoleStr = 'COMMANDER';
                 badgeClass = 'badge Hard';
                 document.getElementById('manage-org-btn').style.display = 'block';
                 document.getElementById('leave-org-btn').style.display = 'none';
            } else if (session.user.can_create_task) {
                 userRoleStr = `${userRoleStr} [CMD]`;
                 badgeClass = 'badge Medium';
                 document.getElementById('manage-org-btn').style.display = 'block';
                 document.getElementById('leave-org-btn').style.display = 'block';
            } else {
                 document.getElementById('manage-org-btn').style.display = 'none';
                 document.getElementById('leave-org-btn').style.display = 'block';
            }
            
            document.getElementById('org-role-badge').innerText = userRoleStr;
            document.getElementById('org-role-badge').className = badgeClass;
            
        } else {
            document.getElementById('org-none-ui').style.display = 'block';
            document.getElementById('org-exists-ui').style.display = 'none';
            app.loadOrgList();
        }

        await app.loadUserProfile();
        app.loadAvailableTasks();
        app.loadBadges();
        app.initNotifications();
        app.initSearch();
    },

    loadBadges: async () => {
        const container = document.getElementById('badges-container');
        if (!container || !app.user) return;
        try {
            const badges = await app.request(`/api/user/badges?user_id=${app.user.user_id}`);
            if (badges.length === 0) {
                container.innerHTML = '<span style="color:var(--color-outline-variant); font-size:12px; font-family:var(--font-label);">NO ACQUIRED BADGES</span>';
                return;
            }
            container.innerHTML = badges.map(b => `
                <div class="badge" title="${b.description}" style="background:var(--color-surface-container-high); color:var(--color-primary); padding:6px 12px; font-size:12px; display:flex; align-items:center; gap:5px; border-radius:4px; border:1px solid var(--color-primary-fixed-dim);">
                    <span class="material-symbols-outlined" style="font-size:16px;">${b.icon}</span>
                    ${b.name}
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<span style="color:var(--color-error); font-size:12px; font-family:var(--font-label);">ERROR SCANNING</span>';
        }
    },

    showCreateOrgModal: () => {
        document.getElementById('create-org-modal').style.display = 'flex';
    },

    createOrg: async () => {
        const name = document.getElementById('new-org-name').value;
        if (!name) return app.showToast('NAME REQUIRED', 'error');
        try {
            const res = await app.request('/api/org/create', 'POST', { name });
            app.showToast('ORGANIZATION ESTABLISHED');
            document.getElementById('create-org-modal').style.display = 'none';
            app.initUser();
        } catch (e) {}
    },
    
    loadOrgList: async () => {
        const listContainer = document.getElementById('join-org-list');
        listContainer.innerHTML = 'Scanning...';
        try {
             const orgs = await app.request('/api/orgs/list');
             listContainer.innerHTML = '';
             if (orgs.length === 0) {
                 listContainer.innerHTML = '<div style="font-size:0.7rem;">NO FACTIONS FOUND</div>';
                 return;
             }
             orgs.forEach(org => {
                 const item = document.createElement('div');
                 item.style.display = 'flex';
                 item.style.justifyContent = 'space-between';
                 item.style.alignItems = 'center';
                 item.style.padding = '5px';
                 item.style.borderBottom = '1px solid #333';
                 item.style.cursor = 'pointer'; 
                 item.onclick = (e) => { 
                    if(e.target.tagName !== 'BUTTON') app.viewOrgProfile(org.org_id); 
                 };
                 item.innerHTML = `
                    <span style="color:#fff; font-size:0.8rem; text-decoration:underline;">${org.name}</span>
                    <button class="cyber-btn" style="padding:2px 5px; font-size:0.6rem;" onclick="event.stopPropagation(); app.viewOrgProfile(${org.org_id})">VIEW</button>
                 `;
                 listContainer.appendChild(item);
             });
        } catch (e) {}
    },
    
    viewOrgProfile: async (orgId) => {
        try {
            const org = await app.request(`/api/org/public/${orgId}`);
            document.getElementById('org-profile-name').innerText = org.name;
            document.getElementById('org-profile-desc').innerText = org.description || 'No information available.';
            document.getElementById('org-profile-count').innerText = org.member_count;
            document.getElementById('org-profile-img').style.backgroundImage = `url('${org.image_url || 'default_faction.png'}')`;
            const btn = document.getElementById('org-profile-join-btn');
            btn.onclick = () => { app.joinOrg(orgId); };
            document.getElementById('org-profile-modal').style.display = 'flex';
        } catch(e) {}
    },

    joinOrg: async (orgId) => {
        try {
            const res = await app.request('/api/org/join', 'POST', { org_id: orgId });
            app.showToast(`JOINED ${res.org_name}`);
            document.getElementById('org-profile-modal').style.display = 'none';
            app.initUser();
        } catch(e) {}
    },

    leaveOrg: async () => {
        if(!confirm("WARNING: DISAVOWING FACTION WILL RESET YOUR RANK AND ACCESS. PROCEED?")) return;
        try {
            await app.request('/api/org/leave', 'POST', {
                org_id: app.session.member_org.org_id
            });
            app.showToast('FACTION DISAVOWED');
            app.initUser();
        } catch(e) {}
    },

    loadUserProfile: async () => {
        try {
            const profile = await app.request(`/api/user/profile?user_id=${app.session.user.user_id}`);
            document.getElementById('user-level').innerText = `LVL ${profile.level}`;
            document.getElementById('user-xp').innerText = `${profile.total_xp} XP`;
            document.getElementById('user-rank-display').innerText = `#${profile.rank}`;
            
            const xpTotalDisplay = document.getElementById('xp-total-display');
            if (xpTotalDisplay) xpTotalDisplay.innerText = `TOTAL XP: ${profile.total_xp}`;
            
            const nextLevelXp = profile.level * 100;
            const xpNextDisplay = document.getElementById('xp-next-display');
            if (xpNextDisplay) xpNextDisplay.innerText = `NEXT RANK: ${nextLevelXp}`;
            
            const xpBarFill = document.getElementById('xp-bar-fill');
            if (xpBarFill) xpBarFill.style.width = `${Math.min((profile.total_xp / nextLevelXp) * 100, 100)}%`;
            
            const statMissions = document.getElementById('stat-missions');
            if (statMissions) statMissions.innerText = profile.completed_missions || 0;
            
            const statStreak = document.getElementById('stat-streak');
            if (statStreak) statStreak.innerText = `${profile.streak || 1} DAYS`;
            
            const histList = document.getElementById('history-list');
            histList.innerHTML = '';
            profile.history.forEach(h => {
                const item = document.createElement('div');
                item.className = 'glass-panel';
                item.style.padding = '12px 16px';
                item.style.marginBottom = '8px';
                item.style.borderRadius = '8px';
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-family:var(--font-body); font-size:14px;">${h.title}</span>
                        <span class="difficulty-badge ${h.status === 'APPROVED' ? 'Easy' : (h.status === 'REJECTED' ? 'Hard' : 'Medium')}" style="font-size:10px;">${h.status}</span>
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

    initProjects: async () => {
        app.initTheme();
        const session = await app.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        app.session = session;
        app.user = session.user;
        const userName = document.getElementById('project-username');
        if (userName) userName.innerText = session.user.username.toUpperCase();
        const form = document.getElementById('project-create-form');
        if (form) form.addEventListener('submit', app.createProject);
        app.initNotifications();
        app.loadProjects();
        app.loadProjectRequests();
    },

    createProject: async (event) => {
        event.preventDefault();
        const data = {
            org_id: null,
            title: document.getElementById('project-title').value.trim(),
            description: document.getElementById('project-description').value.trim(),
            xp_reward: parseInt(document.getElementById('project-xp').value, 10),
            difficulty: document.getElementById('project-difficulty').value,
            category: document.getElementById('project-category').value.trim() || null,
            deadline: document.getElementById('project-deadline').value || null,
            visibility: 'PUBLIC',
            assignee_ids: []
        };
        try {
            await app.request('/api/tasks/create', 'POST', data);
            event.target.reset();
            document.getElementById('project-xp').value = 50;
            app.showToast('PROJECT DEPLOYED');
            app.loadProjects();
        } catch (e) {}
    },

    loadProjects: async () => {
        const container = document.getElementById('project-list');
        if (!container) return;
        container.innerHTML = '<div style="color:var(--color-outline-variant); font-family:var(--font-label); font-size:12px; padding:20px;">SCANNING PROJECTS...</div>';
        try {
            const projects = await app.request('/api/projects');
            if (projects.length === 0) {
                container.innerHTML = '<div class="glass-panel" style="padding:24px; color:var(--color-outline-variant); font-family:var(--font-label); font-size:12px;">NO PROJECTS DEPLOYED YET.</div>';
                return;
            }
            container.innerHTML = projects.map(project => `
                <article class="glass-panel" style="padding:20px; border-radius:12px;">
                    <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start;">
                        <div>
                            <div style="color:var(--color-primary); font-family:var(--font-label); font-size:10px; letter-spacing:0.12em; margin-bottom:6px;">${project.status}</div>
                            <h3 style="margin:0; color:var(--color-on-surface); font-family:var(--font-headline);">${project.title}</h3>
                        </div>
                        <span class="difficulty-badge ${project.difficulty || 'Medium'}">+${project.xp_reward} XP</span>
                    </div>
                    <p style="color:var(--color-on-surface-variant); line-height:1.5; margin:12px 0;">${project.description || 'NO BRIEFING PROVIDED.'}</p>
                    <div style="display:flex; flex-wrap:wrap; gap:14px; color:var(--color-outline-variant); font-family:var(--font-label); font-size:10px; letter-spacing:0.08em;">
                        <span>${project.category ? project.category.toUpperCase() : 'GENERAL'}</span>
                        <span>${project.active_agents} ACTIVE AGENTS</span>
                        <span>${project.pending_requests} PENDING REQUESTS</span>
                        <span>${project.submissions} SUBMISSIONS</span>
                    </div>
                </article>
            `).join('');
        } catch (e) {}
    },

    loadProjectRequests: async () => {
        const container = document.getElementById('project-request-list');
        if (!container) return;
        try {
            const requests = await app.request('/api/tasks/acceptance-requests');
            if (requests.length === 0) {
                container.innerHTML = '<div style="color:var(--color-outline-variant); font-family:var(--font-label); font-size:12px;">NO PENDING ACCEPTANCE REQUESTS.</div>';
                return;
            }
            container.innerHTML = requests.map(request => `
                <div class="input-recessed" style="padding:14px; display:flex; justify-content:space-between; align-items:center; gap:14px;">
                    <div><strong>${request.agent_name}</strong><div style="margin-top:4px; color:var(--color-outline-variant); font-size:12px;">requested ${request.task_title}</div></div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-3d-primary" style="padding:8px 12px; font-size:10px;" onclick="app.reviewAcceptance(${request.acceptance_id}, 'APPROVE')">APPROVE</button>
                        <button class="btn-danger" style="padding:8px 12px; font-size:10px;" onclick="app.reviewAcceptance(${request.acceptance_id}, 'REJECT')">REJECT</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {}
    },
    
    openCreatePublicTaskModal: () => {
        document.getElementById('create-public-task-modal').style.display = 'flex';
    },
    
    handleCreatePublicTask: async (e) => {
        e.preventDefault();
        const data = {
            org_id: null,
            title: document.getElementById('ptask-title').value,
            description: document.getElementById('ptask-desc').value,
            xp_reward: parseInt(document.getElementById('ptask-xp').value),
            difficulty: document.getElementById('ptask-diff').value,
            category: document.getElementById('ptask-category')?.value || null,
            deadline: null,
            visibility: 'PUBLIC',
            assignee_ids: []
        };
        try {
            await app.request('/api/tasks/create', 'POST', data);
            app.showToast('PUBLIC OPERATION DEPLOYED');
            document.getElementById('create-public-task-modal').style.display = 'none';
            document.getElementById('create-public-task-form').reset();
            app.loadAvailableTasks();
        } catch(e) {}
    },

    loadAvailableTasks: async () => {
        const grid = document.getElementById('quest-grid');
        grid.innerHTML = 'LOADING...';
        try {
            let queryStr = '/api/tasks/available';
            const params = new URLSearchParams(app.activeFilters);
            if (params.toString()) queryStr += `?${params.toString()}`;
            
            const tasks = await app.request(queryStr);
            grid.innerHTML = '';
            if (tasks.length === 0) {
                grid.innerHTML = '<div style="text-align:center; color:var(--color-outline-variant); font-family:var(--font-label); padding:40px;">NO MISSIONS DETECTED.</div>';
                return;
            }
            tasks.forEach(task => {
                const countdown = app.getCountdown(task.deadline);

                const card = document.createElement('div');
                card.className = 'quest-card';
                card.innerHTML = `
                    <div class="quest-header">
                        <div class="quest-icon">
                            <span class="material-symbols-outlined">data_object</span>
                        </div>
                        <div class="quest-meta">
                            <span class="difficulty-badge ${task.difficulty || 'Medium'}">[LEVEL: ${task.difficulty ? task.difficulty.toUpperCase() : 'UNKNOWN'}]</span>
                            <span class="quest-xp">+${task.xp_reward} XP</span>
                        </div>
                    </div>
                    <h3 class="quest-title">${task.title}</h3>
                    <div style="font-size:12px; color:var(--color-outline-variant); margin-top:4px; font-family:var(--font-label); letter-spacing:0.1em;">
                        ${task.org_name ? task.org_name.toUpperCase() : 'FREELANCE'} // ${task.creator_name || 'UNKNOWN'}
                    </div>
                    ${task.category ? `<div style="margin-top:6px;"><span style="font-size:10px; background:var(--color-surface-container-high); color:var(--color-tertiary-container); padding:2px 8px; border-radius:3px; font-family:var(--font-label); letter-spacing:0.1em;">${task.category.toUpperCase()}</span></div>` : ''}
                    <p class="quest-desc" style="margin-top:12px;">${task.description}</p>
                    
                    ${countdown ? `<div style="font-size:10px; font-family:var(--font-label); letter-spacing:0.1em; margin-bottom:8px; color:${countdown === 'EXPIRED' ? 'var(--color-error)' : 'var(--color-primary-fixed-dim)'};">
                        <span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle;">schedule</span> ${countdown === 'EXPIRED' ? 'DEADLINE EXPIRED' : `DEADLINE: ${countdown}`}
                    </div>` : ''}
                    
                    ${task.visibility === 'PRIVATE' ? '<div style="font-size:10px; color:var(--color-error); margin-bottom:12px; font-family:var(--font-label);">[CLASSIFIED ACCESS ONLY]</div>' : '<div style="height:12px;"></div>'}
                    
                    <div class="quest-footer">
                        ${task.accepted ? `
                            <div style="width:100%; display:flex; gap:10px;">
                                <div style="flex:1; border:1px solid var(--color-primary); color:var(--color-primary); display:flex; align-items:center; justify-content:center; font-family:var(--font-label); font-size:12px; letter-spacing:0.1em; background:rgba(0, 255, 128, 0.1);">IN PROGRESS</div>
                                <button class="btn-ghost" style="flex:1; border-color:var(--color-primary); color:var(--color-on-surface);" onclick="app.openSubmitModal(${task.task_id})">SUBMIT PROOF</button>
                            </div>
                        ` : task.acceptance_status === 'PENDING' ? `
                            <div style="width:100%; border:1px solid var(--color-tertiary-container); color:var(--color-tertiary-container); padding:10px; text-align:center; font-family:var(--font-label); font-size:11px; letter-spacing:0.1em;">AWAITING CREATOR APPROVAL</div>
                        ` : task.is_creator ? `
                            <div style="width:100%; border:1px solid var(--color-outline-variant); color:var(--color-outline-variant); padding:10px; text-align:center; font-family:var(--font-label); font-size:11px; letter-spacing:0.1em;">YOUR QUEST</div>
                        ` : `
                            <button class="btn-ghost" style="width:100%; border-color:var(--color-outline-variant); color:var(--color-on-surface);" onclick="app.acceptQuest(${task.task_id})">ACCEPT QUEST</button>
                        `}
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                            <span style="font-size:10px; color:var(--color-outline-variant); font-family:var(--font-label);">
                                ${task.acceptance_count || 0} AGENTS ACTIVE
                            </span>
                            <button onclick="app.toggleComments(${task.task_id})" style="background:none; border:none; cursor:pointer; color:var(--color-outline-variant); font-family:var(--font-label); font-size:10px; display:flex; align-items:center; gap:4px;">
                                <span class="material-symbols-outlined" style="font-size:14px;">chat</span> COMMENTS
                            </button>
                        </div>
                    </div>
                    <div id="comments-${task.task_id}" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--color-surface-container-high);"></div>
                `;
                grid.appendChild(card);
            });
        } catch (e) {}
    },

    acceptQuest: async (taskId) => {
        try {
            await app.request(`/api/tasks/${taskId}/accept`, 'POST');
            app.showToast('ACCEPTANCE REQUEST SENT');
            app.loadAvailableTasks();
        } catch (e) {}
    },

    openSubmitModal: (taskId) => {
        document.getElementById('modal-task-id').value = taskId;
        document.getElementById('submission-modal').style.display = 'flex';
    },

    submitProof: async () => {
        const taskId = document.getElementById('modal-task-id').value;
        let proof = document.getElementById('proof-link').value;
        const fileInput = document.getElementById('proof-file');
        
        if (fileInput && fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append("file", fileInput.files[0]);
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/upload`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.detail || 'Upload failed');
                proof = data.url;
            } catch (err) {
                return app.showToast(err.message, 'error');
            }
        }
        
        if (!proof) return app.showToast('PROOF LINK OR FILE REQUIRED', 'error');

        try {
            await app.request('/api/tasks/submit', 'POST', {
                task_id: parseInt(taskId),
                proof_link: proof
            });
            app.showToast('MISSION DATA UPLOADED');
            document.getElementById('submission-modal').style.display = 'none';
            document.getElementById('proof-link').value = '';
            if (fileInput) fileInput.value = '';
        } catch (e) {}
    },

    loadLeaderboard: async () => {
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '<tr><td>Scanning...</td></tr>';
        try {
            const data = await app.request('/api/leaderboard');
            tbody.innerHTML = '';
            data.forEach((u, i) => {
                const row = `
                    <tr style="border-bottom:1px solid var(--color-surface-container-high);">
                        <td style="color:${i===0?'var(--color-primary)':i===1?'var(--color-primary-fixed-dim)':i===2?'var(--color-outline)':'var(--color-outline-variant)'}; padding:12px 0;">#${i+1}</td>
                        <td style="font-family:var(--font-headline); font-weight:600; color:var(--color-on-surface); padding:12px 0;">${u.username}</td>
                        <td style="color:var(--color-tertiary-container); font-family:var(--font-stat); padding:12px 0;">${u.total_xp} XP</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } catch (e) {}
    }
};
