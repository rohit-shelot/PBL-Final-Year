/**
 * University Registrar Authentication Component
 * 
 * Formal authentication screen for MIT-ADT University authorized registrar officials.
 * Provides explicit, accessible login options at all times.
 */
window.universityLoginComponent = {
    render() {
        const isAlreadyLoggedIn = localStorage.getItem('userRole') === 'university' && localStorage.getItem('authSession') === 'true';
        const adminEmail = localStorage.getItem('adminEmail') || 'Administrator';

        return `
            <div class="login-page max-w-md mx-auto fade-in-up" style="max-width: 480px; padding: 0 1rem;">
                <div class="mb-4">
                    <button onclick="navigateTo('role-select')" class="btn-back">
                        ← Back to Portals
                    </button>
                </div>

                <div class="card" style="box-shadow: var(--shadow-lg); border-top: 4px solid var(--brand-purple); padding: 2rem;">
                    <div class="text-center mb-6">
                        <img src="assets/mit-adt-logo.png" alt="MIT Art, Design and Technology University" class="uni-login-logo" />
                        <h2 style="font-size: 1.35rem; margin-bottom: 0.25rem;">Office of the Registrar</h2>
                        <p class="text-muted" style="font-size: 0.88rem; margin-bottom: 0;">MIT Art, Design and Technology University, Pune</p>
                        <span class="badge badge-info" style="margin-top: 0.5rem; font-size: 0.75rem;">Authorized Administrator Sign-In</span>
                    </div>

                    ${isAlreadyLoggedIn ? `
                        <div class="session-notice" style="background: rgba(79, 45, 127, 0.08); border: 1px solid rgba(79, 45, 127, 0.25); padding: 0.85rem 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <div style="font-size: 0.84rem; color: var(--text-primary);">
                                    <span>ℹ️ Active session: <strong>${adminEmail}</strong></span>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button type="button" class="btn btn-small btn-primary" onclick="navigateTo('issuer')" style="padding: 4px 10px; font-size: 0.75rem;">
                                        Enter Portal →
                                    </button>
                                    <button type="button" class="btn btn-small btn-secondary" onclick="window.app.logout(); navigateTo('uni-login');" style="padding: 4px 10px; font-size: 0.75rem;">
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <form id="uni-login-form" class="form-vertical" onsubmit="window.universityLoginComponent.handleLogin(event)">
                        <div class="form-group">
                            <label for="email" style="font-weight: 600; font-size: 0.88rem;">Administrator Email ID *</label>
                            <input 
                                type="email" 
                                id="email" 
                                placeholder="administrator@university.edu" 
                                required
                                autocomplete="email"
                            >
                        </div>

                        <div class="form-group">
                            <label for="password" style="font-weight: 600; font-size: 0.88rem;">Password *</label>
                            <input 
                                type="password" 
                                id="password" 
                                placeholder="••••••••" 
                                required
                                autocomplete="current-password"
                            >
                        </div>

                        <button type="submit" class="btn btn-primary btn-block mt-4" style="padding: 0.75rem; font-weight: 600; font-size: 0.95rem;">
                            Sign In to Administrative Portal →
                        </button>
                    </form>
                    
                    <div class="mt-4 text-center" style="background: var(--bg-muted); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-subtle);">
                        <p style="font-size: 0.8rem; margin: 0; color: var(--text-secondary);">
                            <strong>Secure administrator sign-in</strong><br>
                            Contact the system administrator if you need access.
                        </p>
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        console.log('University login initialized');
        // Do NOT auto-redirect away: keep the login form visible so the user can re-authenticate or switch accounts
    },

    async handleLogin(event) {
        event.preventDefault();
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const submitButton = event.target.querySelector('button[type="submit"]');

        submitButton.disabled = true;
        submitButton.textContent = 'Verifying Credentials...';

        try {
            // The backend issues the only valid administrator session token.
            const data = await window.api.universityLogin(email, password);
            localStorage.setItem('userRole', 'university');
            localStorage.setItem('adminEmail', email);
            if (window.setSessionRole) await window.setSessionRole('university');

            window.app.showToast(data.message || 'Administrator authenticated successfully', 'success');
            navigateTo('issuer');

        } catch (error) {
            window.app.showToast(error.message || 'Authentication failed. Please verify credentials.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Sign In to Administrative Portal →';
        }
    }
};
