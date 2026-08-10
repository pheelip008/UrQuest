const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://urquest-api.onrender.com'; 

const app = {
    user: null, 
    session: null,
    org: null,

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
        toast.innerText = msg;
        area.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    request: async (endpoint, method='GET', body=null) => {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' // CRITICAL: Send cookies with every request
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

    // --- AUTH (Cookie-based, Hangout-style) ---
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
            // Server sets httpOnly cookie — no localStorage needed
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
            // Switch to login view
            app.showLoginForm();
        } catch (e) {}
    },

    handleGoogleLogin: () => {
        window.location.href = `${API_BASE_URL}/auth/google`;
    },

    logout: async () => {
        try {
            await app.request('/api/auth/logout', 'POST');
        } catch (e) {}
        window.location.href = 'index.html';
    },

    // Fetch session from server (replaces localStorage getSession)
    getSession: async () => {
        try {
            const data = await app.request('/api/auth/me');
            if (data.success) {
                return data;
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    // Toggle between login and register forms on index.html
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

    // --- ORG FUNCTIONS ---
    initOrg: async () => {
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
        
        const createTaskForm = document.getElementById('create-task-form');
        if(createTaskForm) createTaskForm.addEventListener('submit', app.handleCreateOrgTask);
        
        const createRoleForm = document.getElementById('create-role-form');
        if(createRoleForm) createRoleForm.addEventListener('submit', app.handleCreateRole);

        const editOrgForm = document.getElementById('edit-org-form');
        if(editOrgForm) editOrgForm.addEventListener('submit', app.handleEditOrg);
    },

    switchOrgTab: (tab) => {
        ['dashboard', 'create', 'reviews', 'settings'].forEach(t => {
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
        }
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
        container.innerHTML = '<div style="text-align:center">SCANNING...</div>';
        try {
            const reviews = await app.request(`/api/org/reviews?org_id=${app.org.org_id}`);
            container.innerHTML = '';
            if (reviews.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#555;">NO PENDING TRANSMISSIONS</div>';
                return;
            }
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
                    <span style="color:${r.can_create_task ? 'var(--primary-color)' : '#fff'}">${r.name} (Lvl ${r.rank})</span>
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

    // --- USER FUNCTIONS ---
    initUser: async () => {
        const session = await app.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        app.session = session;
        document.getElementById('username-display').innerText = session.user.username.toUpperCase();
        
        // Populate Public Task Form Listener
        const ptForm = document.getElementById('create-public-task-form');
         if(ptForm) {
            const newForm = ptForm.cloneNode(true);
            ptForm.parentNode.replaceChild(newForm, ptForm);
            newForm.addEventListener('submit', app.handleCreatePublicTask);
        }
        
        // Update Org UI Logic
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
            app.initUser(); // Refresh session
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
            app.initUser(); // Refresh session
        } catch(e) {}
    },

    leaveOrg: async () => {
        if(!confirm("WARNING: DISAVOWING FACTION WILL RESET YOUR RANK AND ACCESS. PROCEED?")) return;
        try {
            await app.request('/api/org/leave', 'POST', {
                org_id: app.session.member_org.org_id
            });
            app.showToast('FACTION DISAVOWED');
            app.initUser(); // Refresh session
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
            const tasks = await app.request(`/api/tasks/available`);
            grid.innerHTML = '';
            if (tasks.length === 0) {
                grid.innerHTML = 'NO MISSIONS DETECTED.';
                return;
            }
            tasks.forEach(task => {
                let badge = '';
                let badgeClass = 'badge';
                
                if (task.visibility === 'PRIVATE') {
                    badge = 'CONFIDENTIAL';
                    badgeClass = 'badge Hard';
                } else if (task.org_name) {
                    badge = 'FACTION OP';
                    badgeClass = 'badge Medium';
                } else {
                    badge = 'PUBLIC BOUNTY';
                    badgeClass = 'badge Easy';
                }

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
                    <p class="quest-desc" style="margin-top:12px;">${task.description}</p>
                    
                    ${task.visibility === 'PRIVATE' ? '<div style="font-size:10px; color:var(--color-error); margin-bottom:12px; font-family:var(--font-label);">[CLASSIFIED ACCESS ONLY]</div>' : '<div style="height:12px;"></div>'}
                    
                    <div class="quest-footer">
                        <button class="btn-ghost" style="width:100%; border-color:var(--color-outline-variant); color:var(--color-on-surface);" onclick="app.openSubmitModal(${task.task_id})">ACCEPT & SUBMIT</button>
                    </div>
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
            await app.request('/api/tasks/submit', 'POST', {
                task_id: parseInt(taskId),
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
