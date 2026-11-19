/**
 * QRHelper
 * 
 * Provides unified QR code generation, scanning (camera & image file),
 * and modal presentation for DIDs, Verifiable Credentials, and Presentations.
 * 
 * Uses bundled offline QRCode library for generation and supports both
 * Html5Qrcode and native BarcodeDetector for live camera & image scanning.
 */
class QRHelper {
    constructor() {
        this.html5QrCode = null;
        this.cameraStream = null;
        this.scanInterval = null;
        this.activeScannerId = null;
        this.scanInProgress = false;
    }

    /**
     * Keep credential QR codes compact enough for dependable camera scanning.
     * The verifier retrieves this deliberately shared credential by id and then
     * verifies the original cryptographic proof.
     */
    createCredentialReference(credential) {
        if (!credential?.id) throw new Error('Credential id is required to create a verification QR');
        return {
            type: 'DecentralIDCredentialReference',
            version: 1,
            id: credential.id
        };
    }

    /** Keep selective-disclosure QR codes small enough for dependable scans. */
    createSelectivePresentationReference(presentation) {
        if (!presentation?.id || !presentation?.credentialId) {
            throw new Error('Presentation id and credential id are required to create a selective QR');
        }
        // Deliberately use abbreviated field names. A selective QR must be
        // easy to scan from a screenshot as well as a phone camera.
        return {
            t: 'dsp',
            i: presentation.id
        };
    }

    /**
     * Render QR Code into a target DOM element
     * @param {string|HTMLElement} target - Container element or ID
     * @param {string} text - Text or JSON payload to encode
     * @param {Object} options - Custom options (width, height, color, etc.)
     * @returns {Promise<HTMLElement>}
     */
    async render(target, text, options = {}) {
        const container = typeof target === 'string' ? document.getElementById(target) : target;
        if (!container) throw new Error('Target container not found');

        const opts = Object.assign({
            width: 240,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        }, options);

        container.innerHTML = '';

        // If data is very long (> 1000 chars), lower EC level to 'L' to fit up to ~2.9KB
        if (text.length > 700 && (!options.errorCorrectionLevel || options.errorCorrectionLevel === 'M')) {
            opts.errorCorrectionLevel = 'L';
        }

        // Try standard canvas rendering using bundled QRCode
        if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
            const canvas = document.createElement('canvas');
            canvas.className = 'qr-code-canvas';
            container.appendChild(canvas);

            return new Promise((resolve, reject) => {
                window.QRCode.toCanvas(canvas, text, opts, (err) => {
                    if (err) {
                        console.warn('Canvas render error, trying SVG fallback:', err);
                        // Fallback to SVG
                        if (typeof window.QRCode.toString === 'function') {
                            window.QRCode.toString(text, { ...opts, type: 'svg' }, (err2, svg) => {
                                if (err2) reject(err2);
                                else {
                                    container.innerHTML = svg;
                                    resolve(container);
                                }
                            });
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(canvas);
                    }
                });
            });
        }

        // If QRCode.toCanvas is not available, check for QRCode class
        if (typeof window.QRCode === 'function') {
            new window.QRCode(container, {
                text: text,
                width: opts.width,
                height: opts.width,
                colorDark: opts.color.dark,
                colorLight: opts.color.light
            });
            return container;
        }

        throw new Error('QRCode generator library is not loaded');
    }

    /**
     * Generate a Data URL (base64 image) of QR Code
     * @param {string} text 
     * @param {Object} options 
     * @returns {Promise<string>}
     */
    async toDataURL(text, options = {}) {
        const opts = Object.assign({
            width: 300,
            margin: 2,
            errorCorrectionLevel: text.length > 700 ? 'L' : 'M'
        }, options);

        if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
            return new Promise((resolve, reject) => {
                window.QRCode.toDataURL(text, opts, (err, url) => {
                    if (err) reject(err);
                    else resolve(url);
                });
            });
        }
        throw new Error('QRCode library not ready');
    }

    /**
     * Show QR Code in an interactive modal dialog
     * @param {Object} params - { title, subtitle, data, type, downloadFilename }
     */
    async showQRModal({ title = 'QR Code', subtitle = '', data = '', type = 'did', downloadFilename = 'qr-code.png' }) {
        this.closeQRModal();

        const modal = document.createElement('div');
        modal.id = 'qr-display-modal';
        modal.className = 'modal qr-modal-backdrop';

        // Short preview of data
        let previewHTML = '';
        if (type === 'did') {
            previewHTML = `
                <div class="qr-data-preview">
                    <span class="badge badge-success" style="margin-bottom:0.5rem;"><span class="badge-dot"></span> W3C Decentralized Identifier</span>
                    <code class="did-code-small" style="display:block; word-break:break-all;">${data}</code>
                </div>
            `;
        } else if (type === 'credential') {
            let credObj = null;
            try { credObj = typeof data === 'string' ? JSON.parse(data) : data; } catch(e){}
            const student = credObj?.credentialSubject?.name || 'Academic Record';
            const degree = credObj?.credentialSubject?.degree || 'Degree Credential';
            previewHTML = `
                <div class="qr-data-preview">
                    <span class="badge badge-info" style="margin-bottom:0.5rem;">Official Academic Credential</span>
                    <p style="margin:0; font-weight:700; color:var(--text-primary);">${student}</p>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">${degree}</p>
                </div>
            `;
        } else if (type === 'presentation') {
            previewHTML = `
                <div class="qr-data-preview">
                    <span class="badge badge-warning" style="margin-bottom:0.5rem;">Selective Disclosure Presentation</span>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Tamper-proof verifiable presentation with hidden attributes</p>
                </div>
            `;
        }

        // Always use compact JSON (no indentation) to minimize QR code density for better scanning
        const dataString = typeof data === 'string' ? data : JSON.stringify(data);

        modal.innerHTML = `
            <div class="modal-content qr-modal-box">
                <div class="modal-header">
                    <div>
                        <h2>${title}</h2>
                        ${subtitle ? `<p class="text-muted" style="margin:0.25rem 0 0 0; font-size:0.85rem;">${subtitle}</p>` : ''}
                    </div>
                    <button class="btn-close" onclick="window.qrHelper.closeQRModal()">&times;</button>
                </div>
                <div class="modal-body text-center" style="padding:1.5rem 1rem;">
                    <div id="modal-qr-container" class="qr-canvas-wrapper">
                        <div class="spinner" style="margin:2rem auto;"></div>
                    </div>
                    ${previewHTML}
                    <div class="qr-actions-row">
                        <button class="btn btn-secondary btn-small" onclick="window.qrHelper.downloadQR('${downloadFilename}')">
                            ⬇️ Download Image
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="window.qrHelper.copyQRData()">
                            📋 Copy Content
                        </button>
                    </div>
                </div>
                <div class="modal-actions" style="justify-content:center;">
                    <button class="btn btn-primary" onclick="window.qrHelper.closeQRModal()">
                        Done
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this._currentQRData = dataString;

        // Compact references produce large modules that phone cameras can read.
        setTimeout(async () => {
            const qrContainer = document.getElementById('modal-qr-container');
            if (qrContainer) {
                try {
                    await this.render(qrContainer, dataString, {
                        width: 320,
                        margin: 3,
                        errorCorrectionLevel: 'M'
                    });
                } catch (err) {
                    console.error('QR render error:', err);
                    qrContainer.innerHTML = `<p style="color:var(--accent-red);">Failed to render QR Code: ${err.message}</p>`;
                }
            }
        }, 50);
    }

    /**
     * Download the QR code displayed in the active modal as PNG
     */
    async downloadQR(filename = 'decentralid-qr.png') {
        try {
            const canvas = document.querySelector('#modal-qr-container canvas');
            let dataUrl = '';
            if (canvas) {
                dataUrl = canvas.toDataURL('image/png');
            } else if (this._currentQRData) {
                dataUrl = await this.toDataURL(this._currentQRData, { width: 350 });
            }

            if (!dataUrl) {
                window.app?.showError('No QR image found to download');
                return;
            }

            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.click();
            window.app?.showSuccess('QR Code downloaded successfully!');
        } catch (error) {
            console.error('Download error:', error);
            window.app?.showError('Failed to download QR code');
        }
    }

    /**
     * Copy the current QR payload to clipboard
     */
    async copyQRData() {
        if (!this._currentQRData) return;
        try {
            await navigator.clipboard.writeText(this._currentQRData);
            window.app?.showSuccess('Content copied to clipboard!');
        } catch (err) {
            window.app?.showError('Failed to copy to clipboard');
        }
    }

    /**
     * Close the display modal
     */
    closeQRModal() {
        const modal = document.getElementById('qr-display-modal');
        if (modal) modal.remove();
        this._currentQRData = null;
    }

    /**
     * Open interactive QR Code Scanner Modal
     * Supports camera stream and image file upload.
     * @param {Object} options - { title, description, onScan, filter }
     */
    openScannerModal({ title = 'Scan QR Code', description = 'Point your camera at a QR code, or upload an image', onScan, filter = 'any' }) {
        this.closeScannerModal();

        const modal = document.createElement('div');
        modal.id = 'qr-scanner-modal';
        modal.className = 'modal qr-modal-backdrop';

        modal.innerHTML = `
            <div class="modal-content qr-scanner-modal-box">
                <div class="modal-header">
                    <div>
                        <h2>📷 ${title}</h2>
                        <p class="text-muted" style="margin:0.25rem 0 0 0; font-size:0.85rem;">${description}</p>
                    </div>
                    <button class="btn-close" onclick="window.qrHelper.closeScannerModal()">&times;</button>
                </div>
                <div class="modal-body" style="padding:1rem;">
                    <!-- Scanner Tabs -->
                    <div class="verification-tabs" style="margin-bottom:1rem;">
                        <button id="scanner-tab-cam" class="tab-btn active" onclick="window.qrHelper.switchScannerTab('camera')">
                            📹 Live Camera
                        </button>
                        <button id="scanner-tab-upload" class="tab-btn" onclick="window.qrHelper.switchScannerTab('upload')">
                            🖼️ Upload Image
                        </button>
                        <button id="scanner-tab-paste" class="tab-btn" onclick="window.qrHelper.switchScannerTab('paste')">
                            📋 Paste Data
                        </button>
                    </div>

                    <!-- Camera Section -->
                    <div id="scanner-panel-camera">
                        <div class="scanner-viewport-box">
                            <div id="qr-camera-target" class="scanner-camera-view">
                                <video id="qr-video-feed" playsinline autoplay muted style="width:100%; height:100%; object-fit:cover; border-radius:12px;"></video>
                                <div class="scanner-target-reticle">
                                    <div class="scanner-corner top-left"></div>
                                    <div class="scanner-corner top-right"></div>
                                    <div class="scanner-corner bottom-left"></div>
                                    <div class="scanner-corner bottom-right"></div>
                                    <div class="scanner-laser-line"></div>
                                </div>
                            </div>
                        </div>

                        <div class="scanner-controls-bar">
                            <select id="camera-select" class="form-control" style="flex:1; max-width:240px; font-size:0.85rem; padding:0.4rem 0.6rem;">
                                <option value="">Auto Camera</option>
                            </select>
                            <button id="btn-toggle-cam" class="btn btn-secondary btn-small" onclick="window.qrHelper.toggleCamera()">
                                ⏸️ Stop Camera
                            </button>
                        </div>
                        <p id="scanner-status-text" class="text-muted text-center" style="font-size:0.85rem; margin-top:0.5rem;">
                            Scanning for QR code...
                        </p>
                    </div>

                    <!-- Upload Section -->
                    <div id="scanner-panel-upload" class="hidden">
                        <div class="file-drop-area" id="qr-drop-zone" onclick="document.getElementById('qr-file-input').click()">
                            <div style="font-size:2.5rem; margin-bottom:0.5rem;">📁</div>
                            <h4>Drop QR Image Here or Click to Browse</h4>
                            <p class="text-muted" style="font-size:0.85rem;">Supports PNG, JPG, WEBP, SVG screenshots</p>
                            <input type="file" id="qr-file-input" accept="image/*" style="display:none;" onchange="window.qrHelper.handleFileSelect(event)">
                        </div>
                        <div id="file-scan-preview" class="text-center hidden" style="margin-top:1rem;">
                            <img id="file-scan-img" style="max-height:160px; max-width:100%; border-radius:8px; border:1px solid var(--border-subtle); margin-bottom:0.5rem;" />
                            <p id="file-scan-status" style="font-size:0.9rem; font-weight:600;"></p>
                        </div>
                    </div>

                    <!-- Paste / Manual Data Section -->
                    <div id="scanner-panel-paste" class="hidden">
                        <div style="padding:0.5rem 0;">
                            <p class="text-muted" style="font-size:0.85rem; margin-bottom:0.75rem;">
                                📋 Paste a DID string, Credential JSON, or Presentation JSON below and click Verify.
                            </p>
                            <textarea id="scanner-paste-input"
                                rows="8"
                                placeholder='Paste QR content here: a DID (did:key:...) or credential/presentation JSON...'
                                style="width:100%; font-family:monospace; font-size:0.82rem; padding:0.75rem; border-radius:8px; border:1.5px solid var(--border-medium); background:var(--bg-input); color:var(--text-primary); resize:vertical;"
                            ></textarea>
                            <div style="margin-top:0.75rem; display:flex; gap:0.75rem; justify-content:flex-end;">
                                <button class="btn btn-secondary btn-small" onclick="document.getElementById('scanner-paste-input').value=''">Clear</button>
                                <button class="btn btn-primary" onclick="window.qrHelper.submitPasteInput()">
                                    ✓ Verify Pasted Content
                                </button>
                            </div>
                            <p id="paste-scan-status" style="margin-top:0.5rem; font-size:0.85rem; font-weight:600;"></p>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="window.qrHelper.closeScannerModal()">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        this._scanCallback = onScan;
        this._scanFilter = filter;
        this.scanInProgress = false;

        // Init drop zone listeners
        this.initDropZone();

        // Start camera automatically
        setTimeout(() => {
            this.startCameraScanner();
        }, 100);
    }

    /**
     * Switch between Camera, Upload, and Paste tabs in modal
     */
    switchScannerTab(tab) {
        const camBtn = document.getElementById('scanner-tab-cam');
        const uploadBtn = document.getElementById('scanner-tab-upload');
        const pasteBtn = document.getElementById('scanner-tab-paste');
        const camPanel = document.getElementById('scanner-panel-camera');
        const uploadPanel = document.getElementById('scanner-panel-upload');
        const pastePanel = document.getElementById('scanner-panel-paste');

        [camBtn, uploadBtn, pasteBtn].forEach(b => b?.classList.remove('active'));
        [camPanel, uploadPanel, pastePanel].forEach(p => p?.classList.add('hidden'));

        if (tab === 'camera') {
            camBtn?.classList.add('active');
            camPanel?.classList.remove('hidden');
            this.startCameraScanner();
        } else if (tab === 'upload') {
            uploadBtn?.classList.add('active');
            uploadPanel?.classList.remove('hidden');
            this.stopCameraScanner();
        } else if (tab === 'paste') {
            pasteBtn?.classList.add('active');
            pastePanel?.classList.remove('hidden');
            this.stopCameraScanner();
            setTimeout(() => document.getElementById('scanner-paste-input')?.focus(), 100);
        }
    }

    /**
     * Submit pasted DID / JSON content directly to callback
     */
    submitPasteInput() {
        const input = document.getElementById('scanner-paste-input');
        const status = document.getElementById('paste-scan-status');
        if (!input) return;
        const text = input.value.trim();
        if (!text) {
            if (status) { status.textContent = '⚠️ Nothing pasted yet.'; status.style.color = 'var(--accent-orange)'; }
            return;
        }
        // Validate DID filter
        if (this._scanFilter === 'did' && !text.startsWith('did:key:')) {
            if (status) { status.innerHTML = '✗ Not a valid Student DID (must begin with did:key:)'; status.style.color = 'var(--accent-red)'; }
            return;
        }
        // Validate JSON
        if (!text.startsWith('did:') && !text.startsWith('{')) {
            if (status) { status.innerHTML = '✗ Content must be a DID or valid JSON object.'; status.style.color = 'var(--accent-red)'; }
            return;
        }
        if (status) { status.innerHTML = '✓ Content accepted!'; status.style.color = 'var(--accent-green)'; }
        setTimeout(() => this.onSuccessfulScan(text), 350);
    }

    /**
     * Start camera scanning loop
     */
    async startCameraScanner(deviceId = null) {
        this.stopCameraScanner();

        const video = document.getElementById('qr-video-feed');
        const statusText = document.getElementById('scanner-status-text');
        if (statusText) statusText.textContent = 'Requesting camera access...';

        try {
            // First check if Html5Qrcode is available
            if (window.Html5Qrcode) {
                try {
                    const readerId = 'qr-camera-target';
                    this.html5QrCode = new window.Html5Qrcode(readerId);
                    const config = { fps: 10, qrbox: { width: 220, height: 220 } };

                    const cameraConfig = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' };

                    await this.html5QrCode.start(
                        cameraConfig,
                        config,
                        (decodedText) => this.onSuccessfulScan(decodedText),
                        (error) => { /* frame decode failure, ignore */ }
                    );

                    if (statusText) statusText.textContent = 'Point camera at QR code';
                    await this.populateCameraSelect();
                    return;
                } catch (html5Err) {
                    console.warn('Html5Qrcode failed, falling back to BarcodeDetector/video:', html5Err);
                }
            }

            // Fallback: Native getUserMedia + BarcodeDetector
            const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.cameraStream = stream;

            if (video) {
                video.srcObject = stream;
                await video.play();

                if (statusText) statusText.textContent = 'Align QR code inside reticle...';
                await this.populateCameraSelect();

                // Scanning loop using BarcodeDetector if available
                if ('BarcodeDetector' in window) {
                    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                    this.scanInterval = setInterval(async () => {
                        try {
                            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                                const codes = await detector.detect(video);
                                if (codes && codes.length > 0) {
                                    this.onSuccessfulScan(codes[0].rawValue);
                                }
                            }
                        } catch (err) {
                            // detector frame error
                        }
                    }, 250);
                } else {
                    if (statusText) statusText.innerHTML = `Camera active — no BarcodeDetector. <strong><a href="javascript:void(0)" onclick="window.qrHelper.switchScannerTab('upload')" style="color:var(--brand-purple);">Upload a QR screenshot</a></strong> or use the <strong><a href="javascript:void(0)" onclick="window.qrHelper.switchScannerTab('paste')" style="color:var(--brand-purple);">Paste Data tab</a></strong> for best results.`;
                }
            }

        } catch (error) {
            console.error('Camera error:', error);
            if (statusText) {
                statusText.innerHTML = `<span style="color:var(--accent-red);">Camera error: ${error.message}.</span> Please use the <strong><a href="javascript:void(0)" onclick="window.qrHelper.switchScannerTab('upload')" style="color:var(--brand-purple);">Upload Image tab</a></strong> or <strong><a href="javascript:void(0)" onclick="window.qrHelper.switchScannerTab('paste')" style="color:var(--brand-purple);">Paste Data tab</a></strong>.`;
            }
        }
    }

    /**
     * Stop active camera stream
     */
    stopCameraScanner() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        if (this.html5QrCode) {
            try {
                this.html5QrCode.stop().catch(() => {});
            } catch(e){}
            this.html5QrCode = null;
        }

        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }

        const video = document.getElementById('qr-video-feed');
        if (video) video.srcObject = null;
    }

    /**
     * Toggle camera on/off
     */
    toggleCamera() {
        const btn = document.getElementById('btn-toggle-cam');
        if (this.cameraStream || this.html5QrCode) {
            this.stopCameraScanner();
            if (btn) btn.innerHTML = '▶️ Start Camera';
            const statusText = document.getElementById('scanner-status-text');
            if (statusText) statusText.textContent = 'Camera paused';
        } else {
            this.startCameraScanner();
            if (btn) btn.innerHTML = '⏸️ Stop Camera';
        }
    }

    /**
     * Populate camera devices dropdown
     */
    async populateCameraSelect() {
        const select = document.getElementById('camera-select');
        if (!select || !navigator.mediaDevices?.enumerateDevices) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            if (videoDevices.length > 1) {
                select.innerHTML = videoDevices.map((d, i) => `
                    <option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>
                `).join('');

                select.onchange = (e) => {
                    this.startCameraScanner(e.target.value);
                };
            } else {
                select.style.display = 'none';
            }
        } catch (e) {
            // ignore enumerate error
        }
    }

    /**
     * Initialize Drag and Drop zone
     */
    initDropZone() {
        const dropZone = document.getElementById('qr-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-active');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                this.scanImageFile(files[0]);
            }
        }, false);
    }

    /**
     * Handle manual file select
     */
    handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (file) {
            this.scanImageFile(file);
        }
    }

    /**
     * Scan and decode a QR code from an Image File
     */
    async scanImageFile(file) {
        const preview = document.getElementById('file-scan-preview');
        const img = document.getElementById('file-scan-img');
        const status = document.getElementById('file-scan-status');

        if (preview && img && status) {
            preview.classList.remove('hidden');
            img.src = URL.createObjectURL(file);
            status.textContent = 'Decoding QR Code...';
            status.style.color = 'var(--text-primary)';
        }

        try {
            const decodedText = await this.decodeImageFile(file);

            if (decodedText) {
                if (status) {
                    status.innerHTML = '✓ QR Code Detected!';
                    status.style.color = 'var(--accent-green)';
                }
                setTimeout(() => {
                    this.onSuccessfulScan(decodedText);
                }, 300);
            } else {
                if (status) {
                    status.innerHTML = '✗ No QR code detected in this image. Please ensure the QR is clear and well-lit.';
                    status.style.color = 'var(--accent-red)';
                }
            }

        } catch (error) {
            console.error('Scan file error:', error);
            if (status) {
                status.innerHTML = `<span style="color:var(--accent-red);">Scan error: ${error.message}</span>`;
            }
        }
    }

    /** Decode an uploaded image without modifying the visible camera viewport. */
    async decodeImageFile(file) {
        let decodedText = null;
        let reader = null;
        let readerHost = null;

        try {
            if (window.Html5Qrcode) {
                readerHost = document.createElement('div');
                readerHost.id = `qr-file-reader-${Date.now()}`;
                readerHost.style.display = 'none';
                document.body.appendChild(readerHost);
                reader = new window.Html5Qrcode(readerHost.id);
                decodedText = await reader.scanFile(file, true);
            }
        } catch (error) {
            // A nearest-neighbour upscale makes fine QR modules more reliable
            // when a QR was downloaded, screenshotted, or sent through chat.
            try {
                const retryFile = await this.createImageScanRetryFile(file);
                if (retryFile && reader) {
                    decodedText = await reader.scanFile(retryFile, true);
                }
            } catch (retryError) {
                console.warn('Html5Qrcode image scan failed after enhanced retry; trying BarcodeDetector:', retryError);
            }
        } finally {
            // Some html5-qrcode builds implement clear() synchronously. Wrap
            // its return value so cleanup works with either API shape.
            if (reader?.clear) await Promise.resolve(reader.clear()).catch(() => {});
            readerHost?.remove();
        }

        if (!decodedText && 'BarcodeDetector' in window) {
            let bitmap;
            try {
                bitmap = await createImageBitmap(file);
                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                const results = await detector.detect(bitmap);
                decodedText = results?.[0]?.rawValue || null;
            } catch (error) {
                console.warn('BarcodeDetector image scan failed:', error);
            } finally {
                bitmap?.close?.();
            }
        }

        return decodedText;
    }

    /** Create a crisp, enlarged PNG for one additional QR decoder attempt. */
    async createImageScanRetryFile(file) {
        if (typeof createImageBitmap !== 'function' || typeof File === 'undefined') return null;
        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
            const longestSide = Math.max(bitmap.width, bitmap.height);
            if (!longestSide) return null;
            const scale = Math.min(3, Math.max(1, Math.ceil(1500 / longestSide)));
            if (scale <= 1) return null;

            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width * scale;
            canvas.height = bitmap.height * scale;
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = false;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            return blob ? new File([blob], 'selective-qr-retry.png', { type: 'image/png' }) : null;
        } finally {
            bitmap?.close?.();
        }
    }

    /**
     * Called when a QR code has been successfully decoded
     */
    onSuccessfulScan(rawText) {
        if (!rawText || this.scanInProgress) return;
        const text = rawText.trim();

        // Optional filter validation
        if (this._scanFilter === 'did' && !text.startsWith('did:key:')) {
            window.app?.showError('Scanned QR is not a valid Student DID (must begin with did:key:)');
            return;
        }

        this.scanInProgress = true;

        // Preserve the callback before closing the modal; closeScannerModal
        // intentionally clears it during cleanup.
        const callback = this._scanCallback;

        // Play feedback beep if AudioContext is allowed
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch(e){}

        this.closeScannerModal();

        if (typeof callback === 'function') {
            callback(text);
        }
    }

    /**
     * Close Scanner Modal & cleanup hardware streams
     */
    closeScannerModal() {
        this.stopCameraScanner();
        const modal = document.getElementById('qr-scanner-modal');
        if (modal) modal.remove();
        this._scanCallback = null;
        this.scanInProgress = false;
    }
}

// Global Singleton
window.qrHelper = new QRHelper();
