/**
 * Dashboard Component
 * 
 * Main dashboard showing user's identity and credentials.
 */
const dashboardComponent = {
    render() {
        return `
            <div class="dashboard-container">
                <header class="dashboard-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <button class="btn-back" onclick="navigateTo('role-select')">← Portals</button>
                        <div>
                            <span style="font-size: 0.72rem; font-weight: 600; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.05em;">MIT Art, Design and Technology University</span>
                            <h1 style="margin: 0; font-size: 1.35rem;">Student Academic Portal</h1>
                        </div>
                    </div>
                    <div class="student-account-actions" style="display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-left: auto;">
                        <span class="badge badge-success" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;">
                            Enrollment: <strong>${localStorage.getItem('activeEnrollmentNo') || 'Enrolled'}</strong>
                        </span>
                        <button class="btn btn-secondary btn-small" onclick="dashboardComponent.toggleSettings()">
                            Change Password
                        </button>
                        <button class="btn btn-danger btn-small" onclick="window.app.logout()">
                            Sign Out
                        </button>
                    </div>
                </header>

                <div class="dashboard-content">
                    <!-- Identity Card -->
                    <div id="identity-card" class="card">
                        <!-- Populated by init() -->
                    </div>

                    <!-- Main Action -->
                    <div class="action-section mb-6">
                        <div class="role-card" onclick="navigateTo('holder')" style="width: 100%; max-width: 100%; flex-direction: row; justify-content: start; padding: 20px;">
                            <div class="text-left">
                                <h3>Verified Academic Credentials</h3>
                                <p style="margin: 0;">Access certified degrees, transcripts, and generate instant verification QR codes</p>
                            </div>
                            <div style="margin-left: auto; font-size: 1.2rem; color: var(--primary-color); font-weight: bold;">→</div>
                        </div>
                    </div>

                    <!-- Recent Activity -->
                    <div id="recent-activity" class="card">
                        <h2>Institutional Record Ledger</h2>
                        <div id="activity-list">
                            <!-- Populated by init() -->
                        </div>
                    </div>
                </div>

                <!-- Settings Modal -->
                <div id="settings-modal" class="modal hidden">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>Student Portal Settings</h2>
                            <button class="btn-close" onclick="dashboardComponent.toggleSettings()">&times;</button>
                        </div>
                        <div class="modal-body">
                             <!-- Change Password Section -->
                             <div class="credential-detail-section" style="margin-bottom: 1.5rem;">
                                <h3>Change Portal Password</h3>
                                <p class="text-muted mb-4">Update the password dispatched to your email for your personal convenience.</p>
                                
                                <form id="student-change-pwd-form" onsubmit="event.preventDefault(); dashboardComponent.handleChangePassword(event);" class="form-vertical">
                                    <div class="form-group">
                                        <label>Current Password *</label>
                                        <input type="password" id="current-student-pwd" placeholder="Enter current password" required />
                                    </div>
                                    <div class="form-group">
                                        <label>New Password (minimum 8 characters) *</label>
                                        <input type="password" id="new-student-pwd" placeholder="Enter new password" minlength="8" required />
                                    </div>
                                    <div class="form-group">
                                        <label>Confirm New Password *</label>
                                        <input type="password" id="confirm-student-pwd" placeholder="Confirm new password" minlength="8" required />
                                    </div>
                                    <button type="submit" class="btn btn-primary btn-block">
                                        Update Password
                                    </button>
                                </form>
                             </div>

                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async init() {
        await this.renderIdentityCard();
        await this.renderRecentActivity();
    },

    toggleSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.toggle('hidden');
    },

    openSettingsFromCredentials() {
        window.app.navigateTo('dashboard');
        requestAnimationFrame(() => this.toggleSettings());
    },

    async refresh() {
        // Re-initialize the dashboard to reload all data
        await this.renderIdentityCard();
        await this.renderRecentActivity();
        window.app.showSuccess('Dashboard refreshed');
    },

    async renderIdentityCard() {
        const card = document.getElementById('identity-card');
        if (!card) return;

        const did = window.didManager.activeDID;
        if (!did) {
            card.innerHTML = '<p>No active identity</p>';
            return;
        }

        const credentials = await window.credentialManager.getMyCredentials();
        const studentName = localStorage.getItem('activeStudentName') || did.alias || 'Enrolled Student';
        const enrollmentNo = localStorage.getItem('activeEnrollmentNo') || 'N/A';
        const studentEmail = localStorage.getItem('activeStudentEmail') || 'N/A';
        const studentProgram = localStorage.getItem('activeStudentProgram') || 'B.Tech Program';

        card.innerHTML = `
            <div class="identity-header">
                <div class="avatar">${studentName.charAt(0).toUpperCase()}</div>
                <div class="identity-info">
                    <h2>${studentName}</h2>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
                        <strong>${studentProgram}</strong> • Erno: <code>${enrollmentNo}</code>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-bottom: 0.5rem;">
                        ✉️ ${studentEmail}
                    </div>
                    <div class="did-display">
                        <code class="did-code-short" title="${did.id}">${this.shortenDID(did.id)}</code>
                        <button class="btn btn-secondary btn-small student-did-action" onclick="navigator.clipboard.writeText('${did.id}'); window.app.showSuccess('Student DID copied!')" title="Copy DID">
                            Copy
                        </button>
                        <button class="btn btn-secondary btn-small student-did-action" onclick="dashboardComponent.showMyDIDQR()" title="Show Student DID QR">
                            QR Code
                        </button>
                    </div>
                    <span class="badge badge-success" style="margin-top: 0.35rem;">
                        Verified Student Identity
                    </span>
                </div>
            </div>
            <div class="identity-stats">
                <div class="stat">
                    <span class="stat-value">${credentials.length}</span>
                    <span class="stat-label">Issued Degrees</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${enrollmentNo}</span>
                    <span class="stat-label">Enrollment ID</span>
                </div>
            </div>
        `;
    },

    async handleChangePassword(event) {
        const currentPass = document.getElementById('current-student-pwd')?.value;
        const newPass = document.getElementById('new-student-pwd')?.value;
        const confirmPass = document.getElementById('confirm-student-pwd')?.value;

        if (newPass !== confirmPass) {
            window.app.showError("New passwords do not match.");
            return;
        }

        try {
            await window.studentManager.changePassword(currentPass, newPass);
            window.app.showSuccess("Password changed successfully! You can now use your new password to sign in.");
            event.target.reset();
            dashboardComponent.toggleSettings();
        } catch (err) {
            window.app.showError(err.message);
        }
    },

    async renderRecentActivity() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        const credentials = await window.credentialManager.getMyCredentials();

        if (credentials.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <p>No activity yet</p>
                    <p class="text-muted">Issue or receive credentials to get started</p>
                </div>
            `;
            return;
        }

        // Sort by date desc
        const sorted = [...credentials].sort((a, b) => new Date(b.issuanceDate) - new Date(a.issuanceDate));

        const activities = sorted
            .slice(0, 5)
            .map(cred => {
                const isIssued = cred.issuer === window.didManager.activeDID?.id;
                return `
                    <div class="activity-item" style="display:flex; gap:10px; padding:10px; border-bottom:1px solid var(--glass-border);">
                        <span class="activity-icon" style="font-size:0.75rem; font-weight:700;">${isIssued ? 'Issued' : 'Received'}</span>
                        <div class="activity-details">
                            <p class="activity-title" style="margin:0; font-weight:600;">${isIssued ? 'Issued' : 'Received'} credential</p>
                            <small class="text-muted">${cred.credentialSubject.degree || 'Credential'}</small>
                            <p class="activity-meta" style="margin:0; font-size:0.8em; color:var(--text-tertiary);">${new Date(cred.issuanceDate).toLocaleString()}</p>
                        </div>
                    </div>
                `;
            })
            .join('');

        activityList.innerHTML = activities;
    },

    shortenDID(did) {
        if (!did || did.length < 20) return did;
        return `${did.substring(0, 15)}...${did.substring(did.length - 10)}`;
    },

    showMyDIDQR() {
        const did = window.didManager.activeDID;
        if (!did) return;
        window.qrHelper.showQRModal({
            title: 'My Student DID QR Code',
            subtitle: did.alias || 'Decentralized Identifier',
            data: did.id,
            type: 'did',
            downloadFilename: `student-did-${(did.alias || 'identity').toLowerCase().replace(/\s+/g, '-')}.png`
        });
    },

    async exportWallet() {
        try {
            const data = await window.didManager.exportWallet();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ssi-wallet-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            window.app.showSuccess('Wallet backup downloaded');
        } catch (e) {
            window.app.showError('Export failed: ' + e.message);
        }
    },

    async deleteIdentity() {
        // Confirm with user
        const confirmed = confirm(
            '⚠️ WARNING: This will permanently delete your identity and all credentials.\n\n' +
            'This action cannot be undone!\n\n' +
            'Are you sure you want to continue?'
        );

        if (!confirmed) return;

        // Double confirmation
        const doubleConfirm = confirm(
            'This is your last chance!\n\n' +
            'Click OK to permanently delete your identity.'
        );

        if (!doubleConfirm) return;

        try {
            window.app.showLoading();

            // Delete DID and all credentials from IndexedDB
            await window.didManager.deleteDID();

            window.app.hideLoading();
            window.app.showSuccess('Identity deleted successfully');

            // Always redirect to role selector page after deletion
            setTimeout(() => {
                navigateTo('role-select');
            }, 1000);

        } catch (error) {
            window.app.hideLoading();
            window.app.showError('Failed to delete identity: ' + error.message);
        }
    },

    async importWallet(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = e.target.result;
                await window.didManager.importWallet(json);
                window.app.showSuccess('Wallet imported successfully!');
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                window.app.showError('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
    }
};

window.dashboardComponent = dashboardComponent;
