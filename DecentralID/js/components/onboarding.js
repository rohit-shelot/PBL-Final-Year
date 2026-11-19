/**
 * Onboarding Component
 * 
 * Guides new users through creating their first DID.
 */
const onboardingComponent = {
    currentStep: 0,

    render() {
        return `
            <div class="onboarding-container">
                <div class="onboarding-card">
                    <div id="onboarding-content">
                        <!-- Content will be dynamically updated -->
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        this.currentStep = 0;
        this.showStep(0);
    },

    showStep(step) {
        const content = document.getElementById('onboarding-content');
        if (!content) return;

        const steps = [
            this.welcomeStep(),
            this.createIdentityStep(),
            this.successStep()
        ];

        content.innerHTML = steps[step] || steps[0];
        this.currentStep = step;

        if (step === 2) {
            setTimeout(() => {
                const target = document.getElementById('onboarding-did-qr');
                const did = window.didManager.activeDID?.id;
                if (target && did && window.qrHelper) {
                    window.qrHelper.render(target, did, {
                        width: 180,
                        margin: 2
                    }).catch(err => console.error('Onboarding QR error:', err));
                }
            }, 50);
        }
    },

    welcomeStep() {
        return `
            <div class="onboarding-step">
                <div class="icon-large">🎓</div>
                <div style="display:inline-block; padding: 4px 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">
                    MIT-ADT University, Pune
                </div>
                <h1>Student Identity Enrollment</h1>
                <p class="subtitle">Self-Sovereign Academic Credentials & Verifiable Records Portal</p>
                
                <div class="feature-list">
                    <div class="feature-item">
                        <span class="icon">🆔</span>
                        <div>
                            <h3>Decentralized Identifier (DID)</h3>
                            <p>W3C P-256 cryptographic identity generated securely on your device</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <span class="icon">📜</span>
                        <div>
                            <h3>Institutional Credentials</h3>
                            <p>Tamper-proof degree certificates and transcripts digitally attested by the Registrar</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <span class="icon">🛡️</span>
                        <div>
                            <h3>Instant QR Verification</h3>
                            <p>Share verifiable presentations with employers and institutions via secure QR code</p>
                        </div>
                    </div>
                </div>

                <div class="button-group">
                    <button class="btn btn-secondary" onclick="navigateTo('role-select')">
                        ← Back to Portals
                    </button>
                    <button class="btn btn-primary btn-large" onclick="window.onboardingComponent.showStep(1)">
                        Enroll Identity →
                    </button>
                </div>
            </div>
        `;
    },

    createIdentityStep() {
        return `
            <div class="onboarding-step">
                <div class="icon-large">👤</div>
                <h1>Register Student Identity</h1>
                <p class="subtitle">Set up your academic identity credentials</p>

                <form id="create-identity-form" class="form-vertical">
                    <div class="form-group">
                        <label for="identity-alias">Student Full Name / PRN</label>
                        <input 
                            type="text" 
                            id="identity-alias" 
                            placeholder="e.g., Rohit Shelot (PRN: 2020BCSE042)" 
                            required
                            autocomplete="off"
                        />
                        <small>Official name and university registration identifier</small>
                    </div>

                    <div class="info-box">
                        <p><strong>Cryptographic Generation Process:</strong></p>
                        <ul>
                            <li>An ECDSA (P-256) cryptographic key pair is generated locally</li>
                            <li>Your unique W3C DID string (<code>did:key:...</code>) is derived from the public key</li>
                            <li>Private signing keys remain encrypted in client storage</li>
                        </ul>
                    </div>

                    <div class="button-group">
                        <button type="button" class="btn btn-secondary" onclick="window.onboardingComponent.showStep(0)">
                            ← Back
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Generate DID & Complete Enrollment
                        </button>
                    </div>
                </form>
            </div>
        `;
    },

    successStep() {
        const did = window.didManager.activeDID?.id || 'Unknown';
        return `
            <div class="onboarding-step">
                <div class="icon-large success">✓</div>
                <h1>Student Identity Established</h1>
                <p class="subtitle">Your decentralized identifier is provisioned and ready for credential issuance</p>

                <div class="did-display">
                    <label>Assigned Student DID:</label>
                    <code class="did-code">${did}</code>
                    <button class="btn-icon" onclick="navigator.clipboard.writeText('${did}'); window.app.showSuccess('Student DID copied to clipboard!')" title="Copy DID">
                        📋
                    </button>
                </div>

                <!-- Onboarding QR Code -->
                <div class="onboarding-qr-box text-center" style="margin: 1.25rem auto;">
                    <p style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        📱 Student Identity QR (Scan or provide to University Registrar):
                    </p>
                    <div id="onboarding-did-qr" class="qr-canvas-wrapper" style="display: inline-block; padding: 10px; background: #fff; border-radius: 12px; border: 1px solid var(--border-subtle); box-shadow: var(--shadow-sm);">
                        <div class="spinner" style="margin: 1.5rem auto;"></div>
                    </div>
                    <div style="margin-top: 0.75rem;">
                        <button type="button" class="btn btn-secondary btn-small" onclick="window.onboardingComponent.downloadDIDQR()">
                            ⬇️ Download QR Image
                        </button>
                    </div>
                </div>

                <div class="info-box">
                     <p><strong>Institutional Record Notice:</strong></p>
                     <p>Your cryptographic keys are maintained securely in this browser session. You can backup your identity file at any time from Dashboard Settings.</p>
                </div>

                <button class="btn btn-primary btn-large" onclick="navigateTo('dashboard')">
                    Open Student Portal →
                </button>
            </div>
        `;
    },

    downloadDIDQR() {
        const did = window.didManager.activeDID?.id;
        if (!did || !window.qrHelper) return;
        window.qrHelper.downloadQR(`student-did-${window.didManager.activeDID?.alias || 'identity'}.png`);
    },

    async handleCreateIdentity(event) {
        event.preventDefault();

        const alias = document.getElementById('identity-alias').value;

        try {
            window.app.showLoading();

            // Create DID (No PIN)
            await window.didManager.createDID(alias);

            window.app.hideLoading();
            window.app.showSuccess('Identity created successfully!');

            // Show success step
            onboardingComponent.showStep(2);

        } catch (error) {
            window.app.hideLoading();
            window.app.showError('Failed to create identity: ' + error.message);
        }
    }
};

// Event delegation for form submission
document.addEventListener('submit', (e) => {
    if (e.target.id === 'create-identity-form') {
        onboardingComponent.handleCreateIdentity(e);
    }
});

window.onboardingComponent = onboardingComponent;
