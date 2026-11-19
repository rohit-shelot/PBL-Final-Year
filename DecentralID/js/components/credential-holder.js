/**
 * Credential Holder Component
 * 
 * Interface for students to view, manage, and share their academic credentials.
 */
const credentialHolderComponent = {
    selectedCredential: null,

    render() {
        return `
            <div class="page-container">
                <header class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="btn-back" onclick="navigateTo('dashboard')">← Dashboard</button>
                        <h1 style="margin: 0; font-size: 1.35rem;">My Academic Credentials</h1>
                    </div>
                    <div class="student-account-actions">
                        <span class="badge badge-success" style="font-size: 0.78rem;">
                            Enrollment: <strong>${localStorage.getItem('activeEnrollmentNo') || 'Enrolled'}</strong>
                        </span>
                        <button class="btn btn-secondary btn-small" onclick="dashboardComponent.openSettingsFromCredentials()">
                            Change Password
                        </button>
                        <button class="btn btn-danger btn-small" onclick="window.app.logout()">
                            Sign Out
                        </button>
                    </div>
                </header>

                <div class="page-content">
                    <div id="credentials-list" class="credentials-grid">
                        <!-- Populated by init() -->
                    </div>

                    <!-- Credential Detail Modal -->
                    <div id="credential-modal" class="modal hidden">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h2>Credential Details</h2>
                                <button class="btn-close" onclick="credentialHolderComponent.closeModal()">&times;</button>
                            </div>
                            <div id="credential-details" class="modal-body">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async init() {
        await this.renderCredentials();
    },

    async renderCredentials() {
        const container = document.getElementById('credentials-list');
        if (!container) return;

        const credentials = await window.credentialManager.getMyCredentials();

        if (credentials.length === 0) {
            const studentName = localStorage.getItem('activeStudentName') || 'Student';
            const erno = localStorage.getItem('activeEnrollmentNo') || 'N/A';
            const email = localStorage.getItem('activeStudentEmail') || 'N/A';
            const did = window.didManager.activeDID?.id || localStorage.getItem('activeStudentDID') || '';

            container.innerHTML = `
                <div class="empty-state text-left" style="grid-column: 1 / -1; padding: 3.5rem 1.5rem; background: var(--bg-surface); border: 2px dashed var(--border-medium); border-radius: 20px; box-shadow: var(--shadow-sm);">
                    <h2 style="margin: 0 0 0.5rem 0;">No Issued Credentials in Wallet Yet</h2>
                    <p class="text-muted" style="max-width: 720px; margin: 0 0 1.5rem 0; line-height: 1.6;">
                        Hello <strong>${studentName}</strong> (Erno: <code>${erno}</code>). Your W3C Decentralized Identity is active. The MIT-ADT University Office of the Registrar has not issued an attested degree to your account yet. Once issued, your verifiable degree certificate and QR code will appear here automatically.
                    </p>
                    <div style="background: var(--bg-muted); padding: 1rem; border-radius: 10px; max-width: 680px; margin: 0 0 1.5rem 0; border: 1px solid var(--border-subtle); text-align: left;">
                        <p style="margin: 0 0 4px 0; font-size: 0.82rem; color: var(--text-secondary);"><strong>Your Assigned Student DID:</strong></p>
                        <code style="font-size: 0.75rem; word-break: break-all; display: block; margin-bottom: 8px;">${did}</code>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-small btn-secondary student-did-action" onclick="navigator.clipboard.writeText('${did}'); window.app.showSuccess('DID copied!')">
                                Copy DID
                            </button>
                            <button class="btn btn-small btn-secondary student-did-action" onclick="window.qrHelper.showQRModal({ title: 'My Student Identity DID QR', data: '${did}', type: 'did' })" title="Show Student DID QR">
                                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3m3 0v3m-6 3h3m3 0h3m-6-3h3m-3-3h3" /></svg>
                                QR Code
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const html = credentials.map(cred => {
            const isReceived = cred.credentialSubject.id === window.didManager.activeDID?.id;
            const type = isReceived ? 'Verified Holder' : 'Issued by Me';
            const gpa = cred.credentialSubject.gpa !== undefined && cred.credentialSubject.gpa !== null ? cred.credentialSubject.gpa : 'N/A';
            const scale = cred.credentialSubject.gpaScale || 10;
            const gpaDisplay = gpa !== 'N/A' ? `${gpa}/${scale}` : 'N/A';
            const coursesCount = cred.credentialSubject.courses?.length || 0;

            return `
                <div class="credential-card" onclick="credentialHolderComponent.viewCredential('${cred.id}')">
                    <div class="credential-header">
                        <span class="badge badge-${isReceived ? 'success' : 'info'}"><span class="badge-dot"></span> ${type}</span>
                        <span class="credential-date">${new Date(cred.issuanceDate).toLocaleDateString()}</span>
                    </div>
                    <h3>${cred.credentialSubject.name || 'Unknown Student'}</h3>
                    <p class="text-muted" style="font-weight: 600; color: var(--primary) !important; margin-bottom: 0.25rem;">
                        ${cred.credentialSubject.degree || 'Academic Credential'}
                    </p>
                    <p class="text-muted" style="font-size: 0.85rem;">${cred.credentialSubject.institution || 'MIT Art, Design and Technology University'}</p>
                    
                    <div class="credential-stats">
                        <div class="stat-small">
                            <span class="stat-label">CGPA (10-Pt)</span>
                            <span class="stat-value">${gpaDisplay}</span>
                        </div>
                        <div class="stat-small">
                            <span class="stat-label">Courses</span>
                            <span class="stat-value">${coursesCount}</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-secondary btn-small" onclick="event.stopPropagation(); credentialHolderComponent.showCardQR('${cred.id}')" style="margin-top: 0.85rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                        <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3m3 0v3m-6 3h3m3 0h3m-6-3h3m-3-3h3" /></svg>
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    async viewCredential(credentialId) {
        this.selectedCredential = window.credentialManager.getCredential(credentialId);
        if (!this.selectedCredential) return;

        const modal = document.getElementById('credential-modal');
        const details = document.getElementById('credential-details');

        if (!modal || !details) return;

        const subject = this.selectedCredential.credentialSubject;
        const courses = subject.courses || [];
        const isOwner = window.didManager.activeDID?.id === subject.id;

        const coursesHTML = courses.map(course => `
            <tr>
                <td><strong>${course.courseName}</strong></td>
                <td><span class="badge badge-info">${course.grade}</span></td>
                <td>${course.credits}</td>
                <td>${course.year}</td>
            </tr>
        `).join('');

        const ethProof = this.selectedCredential.ethereumProof;
        let ethProofHTML = '';
        if (ethProof) {
            const shortSigner = window.web3Signer 
                ? window.web3Signer.formatAddress(ethProof.signerAddress) 
                : `${ethProof.signerAddress.substring(0, 6)}...${ethProof.signerAddress.substring(ethProof.signerAddress.length - 4)}`;

            ethProofHTML = `
                <div class="credential-detail-section web3-proof-section">
                    <h3>Ethereum Proof (EIP-712)</h3>
                    <div class="web3-proof-card">
                        <div class="web3-proof-header">
                            <span class="badge badge-success"><span class="badge-dot"></span> Signed by ${shortSigner} on Sepolia</span>
                            <span class="badge badge-info">Gasless / Off-Chain</span>
                        </div>
                        <div class="detail-grid" style="margin-top: 0.85rem;">
                            <div class="detail-item" style="grid-column: 1 / -1;">
                                <label>Issuer Ethereum Signer Address</label>
                                <div class="address-copy-row">
                                    <code class="did-code-small" style="flex:1; word-break:break-all;">${ethProof.signerAddress}</code>
                                    <button class="btn btn-secondary btn-small" onclick="navigator.clipboard.writeText('${ethProof.signerAddress}'); window.app.showSuccess('Signer address copied to clipboard!');" title="Copy full address">
                                        Copy
                                    </button>
                                </div>
                            </div>
                            <div class="detail-item">
                                <label>Network</label>
                                <p>Sepolia (Chain ID ${ethProof.chainId || 11155111})</p>
                            </div>
                            <div class="detail-item">
                                <label>Proof Type</label>
                                <p>${ethProof.type || 'EthereumEip712Signature'}</p>
                            </div>
                            <div class="detail-item" style="grid-column: 1 / -1;">
                                <label>Credential Keccak256 Hash</label>
                                <code class="did-code-small" style="word-break: break-all;">${ethProof.credentialHash}</code>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        details.innerHTML = `
            <div class="cert-header" style="margin-bottom: 1.5rem;">
                <img src="assets/mit-adt-logo.png" alt="MIT-ADT University" class="cert-logo" />
                <div class="cert-title-block">
                    <h3>${subject.institution || 'MIT Art, Design and Technology University'}</h3>
                    <p class="cert-subtitle">Official Verifiable Academic Credential</p>
                </div>
                <span class="badge badge-success"><span class="badge-dot"></span> Tamper-Proof VC</span>
            </div>

            <div class="credential-detail-section">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <h3>Student Identity</h3>
                    ${isOwner ? `
                    <div>
                         <button class="btn btn-small btn-icon-danger" onclick="if(confirm('Are you sure you want to delete this credential from your wallet?')) { credentialHolderComponent.deleteCredential('${credentialId}'); }" title="Delete Credential">
                            <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" /></svg>
                         </button>
                    </div>` : ''}
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Student Full Name</label>
                        <p style="color: var(--primary); font-size: 1.05rem;">${subject.name}</p>
                    </div>
                    <div class="detail-item">
                        <label>Student DID</label>
                        <code class="did-code-small">${subject.id}</code>
                    </div>
                </div>
            </div>

            <div class="credential-detail-section">
                <h3>Academic Program & Results</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Awarding University</label>
                        <p>${subject.institution}</p>
                    </div>
                    <div class="detail-item">
                        <label>Degree Program</label>
                        <p>${subject.degree}</p>
                    </div>
                    <div class="detail-item">
                        <label>Cumulative GPA (10-Point)</label>
                        <p style="font-size: 1.2rem; color: var(--brand-gold);"><strong>${subject.gpa !== undefined && subject.gpa !== null ? `${subject.gpa} / ${subject.gpaScale || 10}` : 'N/A'}</strong></p>
                    </div>
                </div>
            </div>

            <div class="credential-detail-section">
                <h3>Course Breakdown</h3>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Grade</th>
                                <th>Credits</th>
                                <th>Year</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${coursesHTML}
                        </tbody>
                    </table>
                </div>
            </div>

            ${ethProofHTML}

            <div class="credential-detail-section">
                <h3>Selective Disclosure</h3>
                <p class="text-muted" style="margin-bottom: 0.75rem;">Choose which specific attributes to disclose to third-party verifiers without revealing your entire academic record</p>
                
                <div style="margin-bottom: 0.75rem;">
                    <button class="btn btn-secondary btn-small" onclick="credentialHolderComponent.toggleSelectAll(event)">
                        Select All
                    </button>
                </div>
                
                <div class="attribute-selector">
                    <label class="checkbox-label">
                        <input type="checkbox" class="attr-checkbox" value="name" checked />
                        <span>Name</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="attr-checkbox" value="institution" checked />
                        <span>Institution</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="attr-checkbox" value="degree" checked />
                        <span>Degree</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="attr-checkbox" value="courses" />
                        <span>Courses (detailed)</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="attr-checkbox" value="gpa" checked />
                        <span>GPA</span>
                    </label>
                </div>
            </div>

            <div class="modal-actions" style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="credentialHolderComponent.closeModal()">
                    Close
                </button>
                <button class="btn btn-secondary" onclick="credentialHolderComponent.showSelectedCredentialQR()">
                    Show QR Code
                </button>
                <button class="btn btn-secondary" onclick="credentialHolderComponent.openInVerifier()">
                    Test in Verifier
                </button>
                <button class="btn btn-primary" onclick="credentialHolderComponent.shareSelectively()">
                    Create Shareable Presentation →
                </button>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    openInVerifier() {
        if (!this.selectedCredential) return;
        // Pass the selected record only for this live navigation. Credentials
        // remain persisted in MongoDB, not localStorage.
        window.pendingVerificationCredential = this.selectedCredential;
        window.app?.showSuccess('Credential copied to Verifier Portal! Redirecting to Verifier...');
        this.closeModal();
        navigateTo('verifier');
    },

    async deleteCredential(id) {
        try {
            window.credentialManager.removeFromCache(id);
            this.closeModal();
            this.renderCredentials();
            window.app.showSuccess('Credential hidden for this browser session. The official MongoDB record was preserved.');
        } catch (e) {
            window.app.showError('Failed to delete: ' + e.message);
        }
    },

    async shareSelectively() {
        if (!this.selectedCredential) return;

        const checkboxes = document.querySelectorAll('.attr-checkbox:checked');
        const attributesToReveal = Array.from(checkboxes).map(cb => cb.value);

        if (attributesToReveal.length === 0) {
            window.app.showError('Please select at least one attribute to share');
            return;
        }

        try {
            window.app.showLoading();

            const presentation = await window.selectiveDisclosure.createSelectivePresentation(
                this.selectedCredential,
                attributesToReveal
            );

            // QR readers struggle with multi-kilobyte proof payloads. Persist
            // the presentation and encode only its public reference in the QR.
            if (!window.api?.saveSelectivePresentation || !window.qrHelper) {
                throw new Error('The selective presentation sharing service is unavailable');
            }
            await window.api.saveSelectivePresentation(presentation);
            const qrReference = window.qrHelper.createSelectivePresentationReference(presentation);

            const shareableData = JSON.stringify(presentation, null, 2);

            window.app.hideLoading();
            this.showShareablePresentation(shareableData, attributesToReveal, qrReference);

        } catch (error) {
            window.app.hideLoading();
            window.app.showError('Failed to create presentation: ' + error.message);
        }
    },

    showShareablePresentation(data, revealed, qrData) {
        const details = document.getElementById('credential-details');
        if (!details) return;

        this.currentPresentationData = data;
        this.currentPresentationQRData = qrData || data;

        details.innerHTML = `
            <div class="text-center" style="margin-bottom: 1.25rem;">
                <div style="font-size: 3rem; color: var(--accent-green); margin-bottom: 0.5rem;">✓</div>
                <h2>Presentation Ready</h2>
                <p class="text-muted">Disclosing only: <strong>${revealed.join(', ')}</strong></p>
            </div>

            <div class="presentation-qr-preview text-center" style="margin-bottom: 1.5rem;">
                <p style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                    Scan to Verify Instantly:
                </p>
                <div id="presentation-inline-qr" class="qr-canvas-wrapper" style="margin: 0 auto; display: inline-block;">
                    <div class="spinner" style="margin: 1.5rem auto;"></div>
                </div>
                <div style="margin-top: 0.85rem;">
                    <button type="button" class="btn btn-primary" onclick="window.credentialHolderComponent.downloadPresentationQR()">
                        ⬇️ Download This QR Image
                    </button>
                </div>
            </div>

            <div class="presentation-data text-center">
                <h3>Or Share JSON Payload</h3>
                <textarea readonly class="presentation-textarea" style="height: 120px;">${data}</textarea>
                
                <div class="button-group" style="justify-content: center; margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="window.credentialHolderComponent.enlargePresentationQR()">
                        Enlarge QR Code
                    </button>
                    <button class="btn btn-secondary" onclick="window.credentialHolderComponent.copyPresentationData()">
                        Copy JSON
                    </button>
                    <button class="btn btn-primary" onclick="window.credentialHolderComponent.copyPresentationLink()">
                        Copy Link
                    </button>
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn btn-primary" onclick="credentialHolderComponent.closeModal()">
                    Done
                </button>
            </div>
        `;

        // Render inline QR code
        setTimeout(() => {
            const qrTarget = document.getElementById('presentation-inline-qr');
            if (qrTarget && window.qrHelper) {
                window.qrHelper.render(qrTarget, JSON.stringify(this.currentPresentationQRData), {
                    width: 220,
                    margin: 2
                }).catch(err => {
                    console.error('Presentation QR render error:', err);
                });
            }
        }, 50);
    },

    showCardQR(credentialId) {
        const cred = window.credentialManager.getCredential(credentialId);
        if (!cred) return;

        window.qrHelper.showQRModal({
            title: 'Verifiable Academic Credential',
            subtitle: `${cred.credentialSubject.name} • ${cred.credentialSubject.degree}`,
            data: window.qrHelper.createCredentialReference(cred),
            type: 'credential',
            downloadFilename: `credential-${cred.credentialSubject.name.toLowerCase().replace(/\s+/g, '-')}.png`
        });
    },

    showSelectedCredentialQR() {
        if (!this.selectedCredential) return;
        this.showCardQR(this.selectedCredential.id);
    },

    enlargePresentationQR() {
        if (!this.currentPresentationData || !this.currentPresentationQRData) return;
        window.qrHelper.showQRModal({
            title: 'Selective Disclosure Presentation QR',
            subtitle: 'Tamper-proof presentation disclosing chosen attributes',
            data: this.currentPresentationQRData,
            type: 'presentation',
            downloadFilename: 'academic-presentation-qr.png'
        });
    },

    /** Download the same selective-disclosure QR displayed in the preview. */
    async downloadPresentationQR() {
        if (!this.currentPresentationData || !this.currentPresentationQRData || !window.qrHelper) return;
        try {
            const dataUrl = await window.qrHelper.toDataURL(JSON.stringify(this.currentPresentationQRData), {
                width: 900,
                margin: 4,
                errorCorrectionLevel: 'L'
            });
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'academic-selective-presentation-qr.png';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.app.showSuccess('Selective disclosure QR image downloaded!');
        } catch (error) {
            console.error('Selective presentation QR download error:', error);
            window.app.showError('Failed to download the selective disclosure QR image');
        }
    },

    async copyPresentationData() {
        if (!this.currentPresentationData) return;
        try {
            await navigator.clipboard.writeText(this.currentPresentationData);
            window.app.showSuccess('Presentation data copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy:', err);
            window.app.showError('Failed to copy to clipboard');
        }
    },

    copyPresentationLink() {
        if (!this.currentPresentationData) return;
        const link = `https://ssi-wallet.app/verify?data=${encodeURIComponent(this.currentPresentationData.substring(0, 50))}...`;
        navigator.clipboard.writeText(link).then(() => {
            window.app.showSuccess('Shareable link copied!');
        }).catch(() => {
            window.app.showError('Failed to copy link');
        });
    },

    toggleSelectAll(event) {
        event.preventDefault();
        const checkboxes = document.querySelectorAll('.attr-checkbox');
        const button = event.target;

        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });

        button.textContent = allChecked ? 'Select All' : 'Deselect All';
    },

    closeModal() {
        const modal = document.getElementById('credential-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.selectedCredential = null;
        this.currentPresentationData = null;
        this.currentPresentationQRData = null;
    }
};

window.credentialHolderComponent = credentialHolderComponent;
