/**
 * Student Authentication Gateway Component
 * 
 * Formal authentication screen for enrolled students of MIT-ADT University.
 * Students sign in with their student ID or registered email and password.
 * Provides explicit, accessible login options at all times.
 */
window.studentLoginComponent = {
    render() {
        const students = window.studentManager ? window.studentManager.getAllStudents() : [];
        const isAlreadyLoggedIn = localStorage.getItem('userRole') === 'student' && localStorage.getItem('authSession') === 'true' && localStorage.getItem('activeEnrollmentNo');
        const activeName = localStorage.getItem('activeStudentName') || 'Student';
        const activeEnrollmentNo = localStorage.getItem('activeEnrollmentNo') || '';

        return `
            <div class="login-page max-w-md mx-auto fade-in-up" style="max-width: 500px; padding: 0 1rem;">
                <div class="mb-4">
                    <button onclick="navigateTo('role-select')" class="btn-back">
                        ← Back to Portals
                    </button>
                </div>

                <div class="card" style="box-shadow: var(--shadow-lg); border-top: 4px solid var(--accent-green); padding: 2rem;">
                    <div class="text-center mb-6">
                        <img src="assets/mit-adt-logo.png" alt="MIT Art, Design and Technology University" class="uni-login-logo" />
                        <h2 style="font-size: 1.35rem; margin-bottom: 0.25rem;">Student Academic Portal</h2>
                        <p class="text-muted" style="font-size: 0.88rem; margin-bottom: 0;">MIT Art, Design and Technology University, Pune</p>
                        <span class="badge badge-success" style="margin-top: 0.5rem; font-size: 0.75rem;">
                            Enrolled Student Sign-In
                        </span>
                    </div>

                    ${isAlreadyLoggedIn ? `
                        <div class="session-notice" style="background: rgba(5, 150, 105, 0.08); border: 1px solid rgba(5, 150, 105, 0.25); padding: 0.85rem 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <div style="font-size: 0.84rem; color: var(--text-primary);">
                                    <span>ℹ️ Active session: <strong>${activeName}</strong> (Erno: ${activeEnrollmentNo})</span>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button type="button" class="btn btn-small btn-success" onclick="navigateTo('dashboard')" style="padding: 4px 10px; font-size: 0.75rem;">
                                        Enter Portal →
                                    </button>
                                    <button type="button" class="btn btn-small btn-secondary" onclick="window.app.logout(); navigateTo('student-login');" style="padding: 4px 10px; font-size: 0.75rem;">
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <form id="student-login-form" class="form-vertical" onsubmit="window.studentLoginComponent.handleLogin(event)">
                        <div class="form-group">
                            <label for="student-identifier" style="font-weight: 600; font-size: 0.88rem;">Student ID or Email *</label>
                            <input 
                                type="text" 
                                id="student-identifier" 
                                placeholder="e.g., MIT2027CS042 or student@mitadt.edu.in" 
                                required
                                autocomplete="username"
                            >
                            <small class="text-muted">Use the student ID or email registered with the university.</small>
                        </div>

                        <div class="form-group">
                            <label for="student-password" style="font-weight: 600; font-size: 0.88rem;">Password *</label>
                            <input 
                                type="password" 
                                id="student-password" 
                                placeholder="••••••••" 
                                required
                                autocomplete="current-password"
                            >
                            <small class="text-muted">Password received in your registration email</small>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block mt-4" style="padding: 0.75rem; font-weight: 600; font-size: 0.95rem; background: var(--accent-green); border: none;">
                            Student Login
                        </button>
                    </form>

                    <!-- Student credentials are never listed or prefilled on the login screen. -->
                    ${false && students.length > 0 ? `
                        <div class="mt-4" style="background: var(--bg-muted); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-subtle);">
                            <p style="font-size: 0.8rem; margin: 0 0 0.5rem 0; color: var(--text-secondary); font-weight: 600;">
                                💡 Enrolled Students in Registry (Click to Quick-Fill Enrollment No.):
                            </p>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${students.slice(0, 4).map(s => `
                                    <button type="button" class="btn btn-secondary btn-small text-left" 
                                            style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; font-size: 0.78rem;"
                                            onclick="window.studentLoginComponent.quickFillId('${s.enrollmentNo}')">
                                        <span><strong>${s.name}</strong> (${s.enrollmentNo})</span>
                                        <span style="font-size: 0.72rem; color: var(--text-tertiary);">Check email for password</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div class="mt-4 text-center">
                        <p style="font-size: 0.8rem; color: var(--text-tertiary); margin: 0;">
                            Haven't received your credentials? Contact the <a href="javascript:void(0)" onclick="navigateTo('uni-login')" style="color: var(--primary-color);">Office of the Registrar</a>.
                        </p>
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        console.log('Student login initialized');
        // Do NOT auto-redirect away: keep the login form visible so the user can re-authenticate or switch accounts
    },

    quickFill(ernoOrEmail) {
        const idInput = document.getElementById('student-identifier');
        const passInput = document.getElementById('student-password');
        if (idInput) idInput.value = ernoOrEmail;
        if (passInput) { passInput.value = ''; passInput.focus(); }
    },

    // Safe quick-fill: only pre-fills the enrollment number, NOT the password (student must enter from their email)
    quickFillId(enrollmentNo) {
        const idInput = document.getElementById('student-identifier');
        if (idInput) idInput.value = enrollmentNo;
        const passInput = document.getElementById('student-password');
        if (passInput) { passInput.value = ''; passInput.focus(); }
        window.app?.showToast(`Enrollment No. ${enrollmentNo} filled — please enter your password from your email`, 'info');
    },

    async handleLogin(event) {
        event.preventDefault();
        const idInput = document.getElementById('student-identifier');
        const passInput = document.getElementById('student-password');
        const identifier = idInput ? idInput.value.trim() : '';
        const password = passInput ? passInput.value : '';
        const submitBtn = event.target.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying Student Identity...';

        try {
            if (!window.studentManager) throw new Error("Student manager is not initialized");

            const student = await window.studentManager.login(identifier, password);

            window.app.showSuccess(`Welcome back, ${student.name}!`);
            navigateTo('dashboard');

        } catch (error) {
            window.app.showError(error.message || 'Login failed. Please check your credentials.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In to Student Portal →';
        }
    }
};
