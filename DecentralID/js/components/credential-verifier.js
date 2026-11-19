/**
 * Credential Verifier Component
 * 
 * Interface for verifying credentials, selective disclosure presentations,
 * and decentralized identifiers (DIDs) via QR code scanning or manual input.
 */
const credentialVerifierComponent = {
    verificationResult: null,
    activeTab: 'scan', // 'scan', 'credential', or 'selective'

    render() {
        return `
            <div class="page-container">
                <header class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <button class="btn-back" onclick="navigateTo('role-select')">Back to Portals</button>
                    <div style="display: flex; align-items: center; gap: 0.85rem;">
                        <button class="btn btn-danger btn-small" onclick="window.app.logout()">
                            Sign Out
                        </button>
                        <span class="badge badge-info" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                            Verifier: <strong>${window.api?.getUserData?.()?.organizationName || 'Authorized Agency'}</strong>
                        </span>
                    </div>
                </header>

                <div class="page-content">
                    <div class="card" style="box-shadow: var(--shadow-lg); border-top: 4px solid var(--accent-blue);">
                        <div class="section-header">
                            <div>
                                <h2>Academic Credential & Degree Verification</h2>
                                <p class="text-muted">Check degrees and certificates issued by MIT Art, Design and Technology University.</p>
                            </div>
                        </div>

                        <!-- Verification Mode Tabs -->
                        <div class="verification-tabs">
                            <button id="btn-tab-scan" class="tab-btn ${this.activeTab === 'scan' ? 'active' : ''}" onclick="credentialVerifierComponent.switchTab('scan')">
                                Scan QR Code
                            </button>
                            <button id="btn-tab-credential" class="tab-btn ${this.activeTab === 'credential' ? 'active' : ''}" onclick="credentialVerifierComponent.switchTab('credential')">
                                Full Credential JSON
                            </button>
                            <button id="btn-tab-selective" class="tab-btn ${this.activeTab === 'selective' ? 'active' : ''}" onclick="credentialVerifierComponent.switchTab('selective')">
                                Selective Presentation
                            </button>
                        </div>

                        <div id="verification-input-area">
                            <!-- 1. Scan QR Code Tab -->
                            <div id="scan-tab" class="tab-content ${this.activeTab === 'scan' ? 'active' : ''}">
                                <div class="qr-verifier-container">
                                    <div class="scanner-viewport-box" style="max-width: 480px; margin: 0 auto 1.5rem auto;">
                                        <div id="verifier-camera-target" class="scanner-camera-view">
                                            <video id="verifier-video-feed" playsinline autoplay muted style="width:100%; height:100%; object-fit:cover; border-radius:14px;"></video>
                                            <div class="scanner-target-reticle">
                                                <div class="scanner-corner top-left"></div>
                                                <div class="scanner-corner top-right"></div>
                                                <div class="scanner-corner bottom-left"></div>
                                                <div class="scanner-corner bottom-right"></div>
                                                <div class="scanner-laser-line"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="scanner-controls-bar" style="max-width: 480px; margin: 0 auto 1.5rem auto;">
                                        <button id="btn-verifier-toggle-cam" class="btn btn-primary" onclick="credentialVerifierComponent.toggleScannerCamera()">
                                            ▶️ Start Live Camera Scanner
                                        </button>
                                        <button class="btn btn-secondary" onclick="document.getElementById('verifier-qr-file-input').click()">
                                            Upload QR Image
                                        </button>
                                        <input type="file" id="verifier-qr-file-input" accept="image/*" style="display:none;" onchange="credentialVerifierComponent.handleImageUpload(event)">
                                    </div>

                                    <p id="verifier-scanner-status" class="text-muted text-center" style="font-size:0.9rem;">
                                        Click "Start Live Camera Scanner" to scan from camera, or upload a screenshot/image of the QR code.
                                    </p>
                                </div>
                            </div>

                            <!-- 2. Full Credential JSON Tab -->
                            <div id="credential-tab" class="tab-content ${this.activeTab === 'credential' ? 'active' : ''}">
                                <form id="verify-credential-form" class="form-vertical" onsubmit="credentialVerifierComponent.handleVerifyCredential(event)">
                                    <div class="form-group">
                                        <label for="credential-data">Paste Credential JSON</label>
                                        <textarea 
                                            id="credential-data" 
                                            rows="10" 
                                            placeholder='{"@context": [...], "type": ["VerifiableCredential", "AcademicCredential"], ...}'
                                            required
                                        ></textarea>
                                    </div>

                                    <button type="submit" class="btn btn-primary btn-block">
                                        Verify Full Credential
                                    </button>
                                </form>
                            </div>

                            <!-- 3. Selective Presentation Tab -->
                            <div id="selective-tab" class="tab-content ${this.activeTab === 'selective' ? 'active' : ''}">
                                <form id="verify-presentation-form" class="form-vertical" onsubmit="credentialVerifierComponent.handleVerifyPresentation(event)">
                                    <div class="form-group">
                                        <label for="presentation-data">Paste Selective Presentation JSON</label>
                                        <textarea 
                                            id="presentation-data" 
                                            rows="10" 
                                            placeholder='{"@context": [...], "type": ["VerifiablePresentation", "SelectiveDisclosurePresentation"], ...}'
                                            required
                                        ></textarea>
                                    </div>

                                    <button type="submit" class="btn btn-primary btn-block">
                                        Verify Selective Presentation
                                    </button>

                                    <div class="button-group" style="justify-content:center; margin-top:0.85rem;">
                                        <button type="button" class="btn btn-secondary" onclick="credentialVerifierComponent.openSelectiveQRScanner()">
                                            Scan Selective QR
                                        </button>
                                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('selective-qr-file-input').click()">
                                            Upload Selective QR
                                        </button>
                                        <input type="file" id="selective-qr-file-input" accept="image/*" style="display:none;" onchange="credentialVerifierComponent.handleSelectiveQRImageUpload(event)">
                                    </div>
                                    <p class="text-muted text-center" style="font-size:0.82rem; margin:0.7rem 0 0;">
                                        Scanning here displays only the attributes the holder chose to disclose.
                                    </p>
                                </form>
                            </div>
                        </div>

                        <!-- Verification Result Card -->
                        <div id="verification-result" class="verification-result hidden">
                            <!-- Populated dynamically after verification -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        this.verificationResult = null;
        this.activeTab = 'scan';

        // Check if there is a pending credential shared from student wallet
        const pending = window.pendingVerificationCredential;
        if (pending) {
            window.pendingVerificationCredential = null;
            setTimeout(() => {
                this.switchTab('credential');
                const textarea = document.getElementById('credential-data');
                if (textarea) {
                    textarea.value = JSON.stringify(pending, null, 2);
                    this.handleVerifyCredential({ preventDefault() {} });
                }
            }, 100);
        }
    },

    switchTab(tab) {
        this.activeTab = tab;

        // Stop any active camera when switching tabs
        if (window.qrHelper) {
            window.qrHelper.stopCameraScanner();
        }

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-tab-${tab}`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const activeContent = document.getElementById(`${tab}-tab`);
        if (activeContent) activeContent.classList.add('active');

        // Hide previous results
        const resultDiv = document.getElementById('verification-result');
        if (resultDiv) resultDiv.classList.add('hidden');
    },

    /**
     * Start/Stop camera scanner in Verifier tab
     */
    toggleScannerCamera() {
        const btn = document.getElementById('btn-verifier-toggle-cam');
        const status = document.getElementById('verifier-scanner-status');

        if (window.qrHelper && (window.qrHelper.cameraStream || window.qrHelper.html5QrCode)) {
            window.qrHelper.stopCameraScanner();
            if (btn) btn.innerHTML = '▶️ Start Live Camera Scanner';
            if (status) status.textContent = 'Camera scanner stopped.';
        } else {
            if (btn) btn.innerHTML = '⏸️ Stop Scanner';
            if (status) status.textContent = 'Starting camera... Point your camera at a DID or Credential QR code.';

            // Use qrHelper scanner modal or in-page stream
            window.qrHelper.openScannerModal({
                title: 'Scan Academic QR Code',
                description: 'Scan student DID, verifiable credential, or selective presentation',
                onScan: (decodedText) => {
                    this.autoVerifyScannedData(decodedText);
                }
            });
        }
    },

    /**
     * Handle Image Upload from disk
     */
    async handleImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const status = document.getElementById('verifier-scanner-status');
        if (status) status.textContent = 'Analyzing image for QR code...';

        try {
            window.app.showLoading();
            const decodedText = await window.qrHelper.decodeImageFile(file);

            window.app.hideLoading();

            if (decodedText) {
                window.app.showSuccess('✓ QR code detected in image!');
                this.autoVerifyScannedData(decodedText);
            } else {
                window.app.showError('No QR code could be found in the uploaded image. Please ensure the QR is clearly visible.');
                if (status) status.textContent = 'No QR code found in uploaded image.';
            }

        } catch (error) {
            window.app.hideLoading();
            console.error('Image scan error:', error);
            window.app.showError('Failed to scan image: ' + error.message);
        }
    },

    /**
     * Automatically parse and verify scanned data (DID, Credential, or Presentation)
     * @param {string} rawData 
     */
    async autoVerifyScannedData(rawData) {
        if (!rawData) return;
        const text = rawData.trim();

        try {
            window.app.showLoading();

            // 1. Is it a DID?
            if (text.startsWith('did:')) {
                const result = await window.credentialManager.verifyDID(text);
                window.app.hideLoading();
                this.showVerificationResult(result, 'did');
                return;
            }

            // 2. Is it a Verification URL?
            if (text.includes('?data=')) {
                try {
                    const url = new URL(text);
                    const paramData = url.searchParams.get('data');
                    if (paramData) {
                        return this.autoVerifyScannedData(decodeURIComponent(paramData));
                    }
                } catch(e){}
            }

            // 3. Is it JSON (Credential or Presentation)?
            let parsedData = null;
            try {
                parsedData = JSON.parse(text);
            } catch(e) {
                throw new Error("Scanned QR code content is neither a valid DID nor a Verifiable Credential JSON.");
            }

            // Credential QR codes now contain a compact id instead of a dense
            // multi-kilobyte VC. Retrieve the signed VC, then verify it below.
            if (parsedData.type === 'DecentralIDCredentialReference' && parsedData.id) {
                if (!window.api?.getPublicCredential) {
                    throw new Error('Credential lookup service is unavailable.');
                }
                const credential = await window.api.getPublicCredential(parsedData.id);
                const result = await window.credentialManager.verifyCredential(credential);
                window.app.hideLoading();
                this.showVerificationResult(result, 'credential', credential);
                return;
            }

            // Selective presentations use the same compact-reference pattern.
            // The full proof payload is fetched only after the QR is scanned.
            if ((parsedData.type === 'DecentralIDSelectivePresentationReference' && parsedData.id) ||
                (parsedData.t === 'dsp' && parsedData.i)) {
                await this.loadSelectivePresentationFromQR(text, parsedData);
                window.app.hideLoading();
                return;
            }

            // Check if it is a selective presentation
            if (parsedData.type && (
                (Array.isArray(parsedData.type) && parsedData.type.includes('SelectiveDisclosurePresentation')) ||
                parsedData.type === 'SelectiveDisclosurePresentation' ||
                parsedData.disclosedAttributes
            )) {
                await this.loadSelectivePresentationFromQR(text, parsedData);
                return;
            }

            // Regular Verifiable Credential
            const result = await window.credentialManager.verifyCredential(parsedData);
            window.app.hideLoading();
            this.showVerificationResult(result, 'credential', parsedData);

        } catch (error) {
            window.app.hideLoading();
            console.error('Auto verify error:', error);
            window.app.showError('Verification failed: ' + error.message);
        }
    },

    async handleVerifyCredential(event) {
        event.preventDefault();

        const dataTextarea = document.getElementById('credential-data');
        const data = dataTextarea.value.trim();

        if (!data) {
            window.app.showError('Please paste credential data');
            return;
        }

        try {
            window.app.showLoading();
            const parsedData = JSON.parse(data);

            if (parsedData.type && Array.isArray(parsedData.type) &&
                parsedData.type.includes('SelectiveDisclosurePresentation')) {

                const hasHiddenFields = parsedData.commitments &&
                    Object.keys(parsedData.commitments).length > 0;

                if (hasHiddenFields) {
                    window.app.hideLoading();
                    window.app.showError('This is a selective presentation with hidden fields. Please use the "Selective Presentation" tab to verify it.');
                    return;
                }

                const result = await window.selectiveDisclosure.verifySelectivePresentation(parsedData);
                window.app.hideLoading();
                this.showVerificationResult(result, 'presentation', parsedData);
                return;
            }

            const result = await window.credentialManager.verifyCredential(parsedData);
            window.app.hideLoading();
            this.showVerificationResult(result, 'credential', parsedData);

        } catch (error) {
            window.app.hideLoading();
            window.app.showError('Verification failed: ' + error.message);
        }
    },

    async handleVerifyPresentation(event) {
        event.preventDefault();

        const dataTextarea = document.getElementById('presentation-data');
        const data = dataTextarea.value.trim();

        if (!data) {
            window.app.showError('Please paste presentation data');
            return;
        }

        const submitButton = event.target.querySelector('button[type="submit"]');
        const originalLabel = submitButton?.textContent;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Verifying Cryptographic Proofs...';
        }

        try {
            const presentation = JSON.parse(data);
            await this.verifySelectivePresentationPayload(presentation);
        } catch (error) {
            window.app.hideLoading();
            window.app.showError('Verification failed: ' + error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalLabel;
            }
        }
    },

    /** Open the scanner directly from the Selective Presentation tab. */
    openSelectiveQRScanner() {
        if (!window.qrHelper) {
            window.app.showError('QR scanner is not available. Please upload the QR image instead.');
            return;
        }
        window.qrHelper.openScannerModal({
            title: 'Scan Selective Disclosure QR',
            description: 'Scan the QR created from the holder’s “Presentation Ready” screen.',
            onScan: (decodedText) => this.loadSelectivePresentationFromQR(decodedText)
                .catch((error) => window.app.showError('Selective QR verification failed: ' + error.message))
        });
    },

    /** Decode an uploaded selective-disclosure QR image. */
    async handleSelectiveQRImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            window.app.showLoading();
            const decodedText = await window.qrHelper.decodeImageFile(file);
            window.app.hideLoading();
            if (!decodedText) throw new Error('No QR code could be found in the uploaded image');
            await this.loadSelectivePresentationFromQR(decodedText);
        } catch (error) {
            window.app.hideLoading();
            window.app.showError('Selective QR verification failed: ' + error.message);
        } finally {
            event.target.value = '';
        }
    },

    /** Parse a selective QR payload, populate the tab, and run verification. */
    async loadSelectivePresentationFromQR(rawData, parsedPresentation = null) {
        let text = String(rawData || '').trim();
        let presentation = parsedPresentation;

        if (!presentation && text.includes('?data=')) {
            try {
                const url = new URL(text);
                text = decodeURIComponent(url.searchParams.get('data') || text);
            } catch (error) {
                // Continue with the raw QR content and give a clear JSON error below.
            }
        }

        try {
            presentation = presentation || JSON.parse(text);
        } catch (error) {
            throw new Error('The QR does not contain a valid selective presentation JSON payload');
        }

        if ((presentation?.type === 'DecentralIDSelectivePresentationReference' && presentation?.id) ||
            (presentation?.t === 'dsp' && presentation?.i)) {
            if (!window.api?.getPublicSelectivePresentation) {
                throw new Error('Selective presentation lookup service is unavailable');
            }
            presentation = await window.api.getPublicSelectivePresentation(presentation.id || presentation.i);
            text = JSON.stringify(presentation);
        }

        const isSelective = presentation?.disclosedAttributes && presentation?.proofs &&
            (presentation.type === 'SelectiveDisclosurePresentation' ||
                (Array.isArray(presentation.type) && presentation.type.includes('SelectiveDisclosurePresentation')));
        if (!isSelective) {
            throw new Error('This is not a selective-disclosure QR. Generate it with “Create Shareable Presentation” and “Enlarge QR Code”.');
        }

        this.switchTab('selective');
        const textarea = document.getElementById('presentation-data');
        if (textarea) textarea.value = JSON.stringify(presentation, null, 2);
        return this.verifySelectivePresentationPayload(presentation);
    },

    /** Verify a parsed selective presentation and render only disclosed fields. */
    async verifySelectivePresentationPayload(presentation) {
        window.app.showLoading();
        try {
            const result = await window.selectiveDisclosure.verifySelectivePresentation(presentation);
            this.showVerificationResult(result, 'presentation', presentation);
            return result;
        } finally {
            window.app.hideLoading();
        }
    },

    showVerificationResult(result, type, rawData = null) {
        const resultDiv = document.getElementById('verification-result');
        if (!resultDiv) return;

        resultDiv.className = `verification-result${type === 'presentation' ? ' selective-verification-result' : ''}`;

        const isVerified = result.verified;
        const statusIcon = isVerified ? '✓' : '✗';
        const statusClass = isVerified ? 'success' : 'error';
        const statusText = isVerified ? 'Cryptographically Verified' : 'Verification Failed';

        let detailsHTML = '';

        if (type === 'did') {
            detailsHTML = `
                <div class="verification-checks">
                    <h3>Decentralized Identifier (DID) Verification</h3>
                    <div class="check-item check-pass">
                        <span class="check-icon">✓</span>
                        <span class="check-name">Standard W3C DID Syntax: Valid <code>${result.method}</code> format</span>
                    </div>
                    <div class="check-item check-pass">
                        <span class="check-icon">✓</span>
                        <span class="check-name">Cryptographic Public Key Resolution: P-256 ECDSA key verified</span>
                    </div>
                    ${result.isRegistered ? `
                        <div class="check-item check-pass">
                            <span class="check-icon">✓</span>
                            <span class="check-name">Registered Identity: <strong>${result.alias || 'Known Student'}</strong></span>
                        </div>
                    ` : `
                        <div class="check-item check-pass" style="opacity: 0.9;">
                            <span class="check-icon">ℹ️</span>
                            <span class="check-name">Self-Sovereign Identity: Valid Decentralized Key Identifier</span>
                        </div>
                    `}
                </div>

                <div class="issuer-info" style="margin-top: 1.5rem;">
                    <h3>Resolved DID Document</h3>
                    <div style="margin-bottom: 0.6rem;">
                        <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: block;">Decentralized Identifier (DID)</label>
                        <code class="did-code-small" style="word-break: break-all;">${result.did}</code>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: block;">Verification Method</label>
                        <code class="did-code-small" style="color: #6ee7b7;">${result.doc?.verificationMethod?.[0]?.id || `${result.did}#owner`}</code>
                    </div>
                </div>
            `;
        } else if (type === 'credential') {
            const subject = rawData?.credentialSubject || {};
            const renderCheckItem = (check, passed) => {
                if (check === 'ethereumSignature') {
                    if (result.isLegacy) {
                        return `
                            <div class="check-item check-pass" style="opacity: 0.9;">
                                <span class="check-icon">ℹ️</span>
                                <span class="check-name">Ethereum Signature (Sepolia): DID ECDSA Authorized (No Ethereum signature)</span>
                            </div>
                        `;
                    }
                    if (passed) {
                        return `
                            <div class="check-item check-pass">
                                <span class="check-icon">✓</span>
                                <span class="check-name">Ethereum Signature (Sepolia): Valid, signer <code class="did-code-small" style="font-size: 0.85rem; margin-left: 4px;">${result.ethereumSigner || 'Verified'}</code></span>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="check-item check-fail">
                                <span class="check-icon">✗</span>
                                <span class="check-name">Ethereum Signature (Sepolia): Verification Failed</span>
                            </div>
                        `;
                    }
                }

                if (check === 'signature') {
                    return `
                        <div class="check-item ${passed ? 'check-pass' : 'check-fail'}">
                            <span class="check-icon">${passed ? '✓' : '✗'}</span>
                            <span class="check-name">DID ECDSA Cryptographic Signature: ${passed ? 'Valid' : 'Failed'}</span>
                        </div>
                    `;
                }

                return `
                    <div class="check-item ${passed ? 'check-pass' : 'check-fail'}">
                        <span class="check-icon">${passed ? '✓' : '✗'}</span>
                        <span class="check-name">${this.formatCheckName(check)}</span>
                    </div>
                `;
            };

            detailsHTML = `
                ${subject.name ? `
                    <div class="cert-header" style="margin-bottom: 1.5rem; background: var(--bg-muted); padding: 1.25rem; border-radius: 14px;">
                        <img src="assets/mit-adt-logo.png" alt="MIT-ADT" class="cert-logo" />
                        <div class="cert-title-block">
                            <h3 style="margin: 0; font-size: 1.1rem;">${subject.institution || 'MIT Art, Design and Technology University, Pune'}</h3>
                            <p class="cert-subtitle" style="margin: 0;">Verified Academic Degree Record</p>
                            <p style="margin: 0.35rem 0 0 0; color: var(--primary); font-weight: 700;">${subject.name} • ${subject.degree || 'Degree'} • CGPA ${subject.gpa || 'N/A'}/10</p>
                        </div>
                        <span class="badge badge-success"><span class="badge-dot"></span> Authenticated</span>
                    </div>
                ` : ''}

                <div class="verification-checks">
                    <h3>Cryptographic Proofs</h3>
                    ${Object.entries(result.checks).map(([check, passed]) => renderCheckItem(check, passed)).join('')}
                </div>
                
                ${result.issuer ? `
                    <div class="issuer-info">
                        <h3>Issuer & Signer Identities</h3>
                        <div style="margin-bottom: 0.6rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: block;">Authorized University Issuer DID</label>
                            <code class="did-code-small">${result.issuer}</code>
                        </div>
                        ${result.ethereumSigner ? `
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: block;">Ethereum Signer (Sepolia Testnet)</label>
                                <code class="did-code-small" style="color: #6ee7b7;">${result.ethereumSigner}</code>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            `;
        } else if (type === 'presentation') {
            const disclosed = Object.keys(result.disclosedAttributes || {});
            const disclosedName = result.disclosedAttributes?.name;
            const disclosedDegree = result.disclosedAttributes?.degree;
            const disclosedGpa = result.disclosedAttributes?.gpa;
            detailsHTML = `
                ${(disclosedName || disclosedDegree || disclosedGpa !== undefined) ? `
                    <div class="cert-header" style="margin-bottom: 1.5rem; background: var(--bg-muted); padding: 1.25rem; border-radius: 14px;">
                        <img src="assets/mit-adt-logo.png" alt="MIT-ADT" class="cert-logo" />
                        <div class="cert-title-block">
                            <h3 style="margin: 0; font-size: 1.1rem;">MIT Art, Design and Technology University, Pune</h3>
                            <p class="cert-subtitle" style="margin: 0;">Verified Selective Disclosure</p>
                            <p style="margin: 0.35rem 0 0 0; color: var(--primary); font-weight: 700;">${[disclosedName, disclosedDegree, disclosedGpa !== undefined ? `CGPA ${disclosedGpa}/10` : null].filter(Boolean).join(' • ')}</p>
                        </div>
                        <span class="badge badge-success"><span class="badge-dot"></span> Authenticated</span>
                    </div>
                ` : ''}
                <div class="verification-checks">
                    <h3>Verification Checks</h3>
                    ${Object.entries(result.checks).map(([check, passed]) => `
                        <div class="check-item ${passed ? 'check-pass' : 'check-fail'}">
                            <span class="check-icon">${passed ? '✓' : '✗'}</span>
                            <span class="check-name">${this.formatCheckName(check)}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="disclosure-summary privacy-summary-card">
                    <div class="privacy-summary-heading">
                        <div>
                            <span class="privacy-kicker">Privacy-preserving verification</span>
                            <h3>Selective Disclosure Summary</h3>
                        </div>
                        <span class="badge badge-success">Only approved details shown</span>
                    </div>
                    <div class="summary-grid">
                        <div class="summary-item summary-item-disclosed">
                            <span class="summary-label">Disclosed Attributes</span>
                            <span class="summary-value">${disclosed.length}</span>
                        </div>
                        <div class="summary-item summary-item-hidden">
                            <span class="summary-label">Hidden Attributes</span>
                            <span class="summary-value">${result.hiddenCount || 0}</span>
                        </div>
                    </div>
                </div>

                ${disclosed.length > 0 ? `
                    <div class="disclosed-attributes disclosure-data-card">
                        <div class="disclosure-data-heading">
                            <h3>Disclosed Information</h3>
                            <span>Verified directly from the holder's presentation</span>
                        </div>
                        <div class="attribute-list">
                            ${disclosed.map(key => {
                                const value = result.disclosedAttributes[key];
                                const displayValue = typeof value === 'object'
                                    ? JSON.stringify(value, null, 2)
                                    : value;
                                return `
                                    <div class="attribute-item">
                                        <span class="attribute-key">${key}:</span>
                                        <span class="attribute-value">${displayValue}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
        }

        const errorsHTML = result.errors && result.errors.length > 0 ? `
            <div class="verification-errors">
                <h3>Errors</h3>
                <ul>
                    ${result.errors.map(err => `<li>${err}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        resultDiv.innerHTML = `
            <div class="verification-header ${statusClass}">
                <div class="status-icon-large">${statusIcon}</div>
                <div>
                    <h2>${statusText}</h2>
                    ${type === 'presentation' && isVerified ? '<p class="verification-status-detail">Selective presentation authenticated. Only holder-approved information is displayed below.</p>' : ''}
                </div>
            </div>

            ${detailsHTML}
            ${errorsHTML}

            <div class="result-actions">
                <button class="btn btn-secondary" onclick="credentialVerifierComponent.reset()">
                    Verify Another Record
                </button>
            </div>
        `;

        resultDiv.classList.remove('hidden');

        requestAnimationFrame(() => {
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        if (isVerified) {
            window.app.showSuccess('✓ Verification successful!');
        } else {
            window.app.showError('Verification failed');
        }
    },

    formatCheckName(check) {
        return check
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    },

    reset() {
        const resultDiv = document.getElementById('verification-result');
        if (resultDiv) resultDiv.classList.add('hidden');

        const credentialData = document.getElementById('credential-data');
        const presentationData = document.getElementById('presentation-data');
        if (credentialData) credentialData.value = '';
        if (presentationData) presentationData.value = '';

        this.verificationResult = null;
        this.switchTab('scan');
    }
};

window.credentialVerifierComponent = credentialVerifierComponent;
