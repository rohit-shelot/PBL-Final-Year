/**
 * Verifier Portal Authentication Component
 * 
 * Formal authentication screen for external background screening agencies,
 * employers, and credential verifiers.
 */
window.verifierLoginComponent = {
    render() {
        return `
            <div class="login-page max-w-md mx-auto fade-in-up">
                <div class="mb-6">
                    <button onclick="navigateTo('role-select')" class="btn-back">
                        ← Back to Portals
                    </button>
                </div>

                <div class="card" style="box-shadow: var(--shadow-lg); border-top: 4px solid var(--accent-blue);">
                    <div class="text-center mb-6">
                        <div class="role-icon mb-3" style="width: 56px; height: 56px; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: rgba(2, 132, 199, 0.1); border-radius: 14px; font-size: 1.5rem;">
                            Verify
                        </div>
                        <h2 style="font-size: 1.35rem; margin-bottom: 0.25rem;">Credential Verification Agency Portal</h2>
                        <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 0;">Institutional Attestation & Background Authentication</p>
                    </div>

                    <form id="verifier-login-form" class="form-vertical" onsubmit="window.verifierLoginComponent.handleLogin(event)">
                        <div class="form-group">
                            <label for="org-id">Agency / Organization Identifier</label>
                            <input 
                                type="text" 
                                id="org-id" 
                                placeholder="Enter organization ID" 
                                required
                                autocomplete="username"
                            >
                        </div>

                        <div class="form-group">
                            <label for="password">Password</label>
                            <input 
                                type="password" 
                                id="password" 
                                placeholder="••••••••" 
                                required
                                autocomplete="current-password"
                            >
                        </div>

                        <button type="submit" class="btn btn-primary btn-block mt-4" style="padding: 0.75rem; font-weight: 600;">
                            Authenticate Agency Access →
                        </button>
                    </form>

                </div>
            </div>
        `;
    },

    init() {
        console.log('Verifier login initialized');
    },

    async handleLogin(event) {
        event.preventDefault();
        const orgId = document.getElementById('org-id').value.trim();
        const password = document.getElementById('password').value;
        const submitButton = event.target.querySelector('button[type="submit"]');

        submitButton.disabled = true;
        submitButton.textContent = 'Authenticating Agency...';

        try {
            const data = await window.api.verifierLogin(orgId, password);
            localStorage.setItem('userRole', 'verifier');
            if (window.setSessionRole) await window.setSessionRole('verifier');

            window.app.showToast(data.message || 'Verifier authenticated successfully', 'success');
            navigateTo('verifier');

        } catch (error) {
            window.app.showToast(error.message || 'Authentication failed. Please verify credentials.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Authenticate Agency Access →';
        }
    }
};
