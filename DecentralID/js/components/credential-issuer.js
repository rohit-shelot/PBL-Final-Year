/**
 * Office of the Registrar - Credential Issuance Component
 * 
 * Formal administrative portal for MIT-ADT University to:
 * 1. Provision & register decentralized identifiers (DIDs) for students
 * 2. Issue cryptographically attested academic credentials and degrees
 * 3. Import registrar CSV records into the student directory with automatic DID generation
 * 4. Sign off-chain attestations using W3C ECDSA keys and optional MetaMask Sepolia proofs.
 */
const credentialIssuerComponent = {
    courses: [],
    issuedCredentials: [],
    provisionedStudents: [],
    activeTab: 'students', // 'students' (1st), 'issue' (2nd), or 'history' (3rd)
    currentMetaMaskStatus: null,
    studentImportResults: [],
    isStudentImporting: false,
    isDirectoryBatchIssuing: false,
    certificateIssuanceMode: 'batch', // 'individual' or 'batch'
    isBulkDeleting: false,
    selectedStudentErno: '',

    render() {
        const issuerDID = window.didManager.activeDID?.id || 'MIT-ADT Issuer';
        const adminEmail = localStorage.getItem('adminEmail') || 'Administrator';

        return `
            <div class="page-container">
                <header class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <button class="btn-back" onclick="navigateTo('role-select')">Back to Portals</button>
                    <div style="display: flex; align-items: center; gap: 0.85rem;">
                        <button class="btn btn-danger btn-small" onclick="window.app.logout()">
                            Sign Out
                        </button>
                        <span class="badge badge-info" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                            Admin: <strong>${adminEmail}</strong>
                        </span>
                    </div>
                </header>

                <div class="page-content">
                    
                    <!-- MIT-ADT University Formal Institutional Header -->
                    <div class="uni-issuer-hero" style="border-top: 4px solid var(--brand-purple);">
                        <div class="uni-issuer-brand">
                            <div class="uni-logo-box">
                                <img src="assets/mit-adt-logo.png" alt="MIT Art, Design and Technology University" class="uni-issuer-logo" />
                            </div>
                            <div class="uni-issuer-details">
                                <div class="uni-badge-row">
                                    <span class="badge badge-success"><span class="badge-dot"></span> Authorized Academic Registrar</span>
                                </div>
                                <h2 style="font-size: 1.5rem; letter-spacing: -0.01em;">MIT Art, Design and Technology University, Pune</h2>
                            </div>
                        </div>
                        <div class="uni-issuer-meta">
                            <div class="issuer-did-chip">
                                <span class="chip-label">Official University Authority DID</span>
                                <code class="did-code-small">${issuerDID}</code>
                            </div>
                        </div>
                    </div>

                    <!-- Streamlined 3-Step Academic Navigation Tabs -->
                    <div class="verification-tabs">
                        <button class="tab-btn ${this.activeTab === 'students' ? 'active' : ''}" 
                                onclick="credentialIssuerComponent.switchTab('students')">
                            1. Register Students
                        </button>
                        <button class="tab-btn ${this.activeTab === 'issue' ? 'active' : ''}" 
                                onclick="credentialIssuerComponent.switchTab('issue')">
                            2. Issue Certificates
                        </button>
                        <button class="tab-btn ${this.activeTab === 'history' ? 'active' : ''}" 
                                onclick="credentialIssuerComponent.switchTab('history')">
                            3. Issued Certificates (${this.issuedCredentials.length})
                        </button>
                    </div>

                    <!-- 1. Register Students Tab (First / Default) -->
                    <div id="tab-students" class="tab-content ${this.activeTab === 'students' ? 'active' : ''}">
                        ${this.renderStudentsTabHTML()}
                    </div>

                    <!-- 2. Issue Certificate Tab -->
                    <div id="tab-issue" class="tab-content ${this.activeTab === 'issue' ? 'active' : ''}">
                        <div class="card">
                            <div class="section-header" style="margin-bottom: 1.25rem;">
                                <div>
                                    <h2>Issue Verifiable Academic Degree Certificate</h2>
                                </div>
                            </div>

                            <p class="text-muted" style="margin: -0.5rem 0 1.25rem;">Student CSV import and DID creation are completed in Step 1. Choose an individual review or issue every pending certificate at once.</p>
                            <div style="display: flex; gap: 8px; margin-bottom: 1.5rem; background: var(--bg-muted); padding: 6px; border-radius: 10px; width: fit-content; border: 1px solid var(--border-subtle);">
                                <button type="button" class="btn ${this.certificateIssuanceMode === 'individual' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="credentialIssuerComponent.setCertificateIssuanceMode('individual')">
                                    Review & Issue Individually
                                </button>
                                <button type="button" class="btn ${this.certificateIssuanceMode === 'batch' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="credentialIssuerComponent.setCertificateIssuanceMode('batch')">
                                    Issue All Pending Certificates
                                </button>
                            </div>
                            ${this.renderStudentCertificateDirectoryHTML()}
                            ${this.certificateIssuanceMode === 'individual' ? this.renderManualIssuanceHTML() : this.renderDirectoryBatchIssuanceHTML()}
                        </div>
                    </div>

                    <!-- 3. Issued Certificates Tab -->
                    <div id="tab-history" class="tab-content ${this.activeTab === 'history' ? 'active' : ''}">
                        ${this.renderHistoryTabHTML()}
                    </div>
                </div>
            </div>

            <!-- Preview Modal -->
            <div id="preview-modal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Verifiable Academic Credential Preview</h2>
                        <button class="btn-close" onclick="credentialIssuerComponent.closePreview()">&times;</button>
                    </div>
                    <div class="modal-body" id="preview-content">
                        <!-- Content injected dynamically -->
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="credentialIssuerComponent.closePreview()">← Edit Details</button>
                        <button class="btn btn-primary" id="btn-sign-issue" onclick="credentialIssuerComponent.submitIssuance()">
                            Authorize & Issue Credential
                        </button>
                    </div>
                </div>
            </div>

            <!-- Bulk Student Deletion Confirmation Modal -->
            <div id="delete-all-students-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="delete-all-students-title">
                <div class="modal-content" style="max-width: 520px;">
                    <div class="modal-header">
                        <h2 id="delete-all-students-title">Delete pending students?</h2>
                    </div>
                    <div class="modal-body">
                        <p id="delete-all-students-message" style="margin-top: 0;"></p>
                        <p class="text-muted" style="margin-bottom: 0;">This removes pending unissued student accounts only. Once an academic degree is issued, it becomes a permanent record and cannot be deleted.</p>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="credentialIssuerComponent.cancelDeleteAllStudents()">Cancel</button>
                        <button type="button" class="btn btn-danger" onclick="credentialIssuerComponent.confirmDeleteAllStudents()">Okay</button>
                    </div>
                </div>
            </div>
        `;
    },

    isCertificateIssuedForStudent(student) {
        if (!student) return false;
        return (this.issuedCredentials || []).some(credential =>
            credential.credentialSubject?.id === student.did ||
            (student.enrollmentNo && (
                credential.credentialSubject?.enrollmentNo?.toUpperCase() === student.enrollmentNo.toUpperCase() ||
                credential.credentialSubject?.prn?.toUpperCase() === student.enrollmentNo.toUpperCase()
            ))
        );
    },

    setCertificateIssuanceMode(mode) {
        this.certificateIssuanceMode = mode === 'individual' ? 'individual' : 'batch';
        this.switchTab('issue');
    },

    renderStudentCertificateDirectoryHTML() {
        const students = window.studentManager ? window.studentManager.getAllStudents() : [];
        const pendingStudents = students.filter(student => !this.isCertificateIssuedForStudent(student));
        return `
            <div class="form-section" style="margin-bottom: 1.5rem;">
                <div class="section-header">
                    <div>
                        <h3 style="margin: 0;">Student Certificate Directory (${students.length})</h3>
                        <p class="text-muted" style="margin: 0.3rem 0 0; font-size: 0.85rem;">Review registered students and issue academic certificates. Unissued student records can be deleted; once a certificate is issued, it cannot be deleted.</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        ${pendingStudents.length > 0 ? `
                            <button type="button" class="btn btn-danger btn-small" onclick="credentialIssuerComponent.openDeleteAllStudentsModal()" title="Delete all pending enrolled students">
                                Delete Pending (${pendingStudents.length})
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-secondary btn-small" onclick="credentialIssuerComponent.switchTab('students')">Register or Import Students</button>
                    </div>
                </div>
                ${students.length ? `
                    <div class="table-responsive">
                        <table class="table">
                            <thead><tr><th>Enrollment No.</th><th>Student</th><th>Email</th><th>Assigned DID</th><th>Subjects & Marks</th><th>Certificate</th><th>Action</th></tr></thead>
                            <tbody>
                                ${students.map(student => {
                                    const issued = this.isCertificateIssuedForStudent(student);
                                    return `
                                        <tr>
                                            <td><span class="badge badge-success" style="font-size: 0.78rem;">${student.enrollmentNo}</span></td>
                                            <td><strong>${student.name}</strong><br><small class="text-muted">${student.program || ''}</small></td>
                                            <td>${student.email}</td>
                                            <td><code class="did-code-small" title="${student.did || ''}">${student.did ? `${student.did.substring(0, 14)}...${student.did.substring(student.did.length - 8)}` : 'Missing'}</code></td>
                                            <td>${student.courses?.length
                                                ? `<strong>${student.courses.length} subject${student.courses.length === 1 ? '' : 's'}</strong><br><small class="text-muted">${student.courses.map(course => `${course.subject || course.courseName}: ${course.marks ?? course.grade}`).join(', ')}</small><br><small>CGPA: ${student.gpa ?? 'Calculated on issue'}</small>`
                                                : '<span class="text-muted">Not imported</span>'
                                            }</td>
                                            <td>${issued ? '<span class="badge badge-success">Issued</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
                                            <td>
                                                <div style="display: flex; gap: 6px; align-items: center;">
                                                    ${issued
                                                        ? `<button class="btn btn-small btn-secondary" onclick="credentialIssuerComponent.viewStudentCredential('${student.did}', '${student.enrollmentNo}')">View Degree</button>
                                                           <span class="badge badge-success" style="font-size: 0.72rem;" title="Official certificate issued. Permanent record.">Permanent</span>`
                                                        : `<button class="btn btn-small btn-primary" onclick="credentialIssuerComponent.prefillCredentialForStudent('${student.did}', '${student.name}', '${student.enrollmentNo}')">Review & Issue</button>
                                                           <button class="btn btn-small btn-danger" onclick="credentialIssuerComponent.deleteStudent(decodeURIComponent('${encodeURIComponent(student.enrollmentNo)}'))" title="Delete pending student">
                                                               <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" /></svg>
                                                           </button>`
                                                    }
                                                </div>
                                            </td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state text-center" style="padding: 1.5rem 1rem;"><p class="text-muted">No students are registered yet. Complete Step 1 first.</p></div>
                `}
            </div>
        `;
    },

    renderDirectoryBatchIssuanceHTML() {
        const students = window.studentManager ? window.studentManager.getAllStudents() : [];
        const pendingStudents = students.filter(student => !this.isCertificateIssuedForStudent(student));

        return `
            <div id="issuer-metamask-status" style="margin-bottom: 1.5rem;">
                ${this.renderMetaMaskStatusHTML(this.currentMetaMaskStatus)}
            </div>
            <div class="form-section" style="text-align: center; padding: 2rem;">
                <h3 style="margin-top: 0;">Batch Certificate Issuance</h3>
                <p class="text-muted" style="max-width: 640px; margin: 0 auto 1.25rem;">This issues one signed verifiable degree certificate to every student with a registered DID that does not already have a certificate. Existing certificates are never duplicated.</p>
                <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                    <span class="badge badge-info">${students.length} registered student${students.length === 1 ? '' : 's'}</span>
                    <span class="badge badge-warning">${pendingStudents.length} pending certificate${pendingStudents.length === 1 ? '' : 's'}</span>
                </div>
                ${pendingStudents.length > 0 ? `
                    <button type="button" id="btn-issue-all-student-certificates" class="btn btn-primary btn-large" onclick="credentialIssuerComponent.issueAllRegisteredStudentCertificates()">
                        Issue All Student Certificates (${pendingStudents.length})
                    </button>
                    <p class="text-muted" style="font-size: 0.8rem; margin: 0.85rem 0 0;">Batch issuance uses the university DID signature so MetaMask is not prompted once per student.</p>
                ` : students.length > 0 ? `
                    <span class="badge badge-success" style="font-size: 0.9rem; padding: 0.55rem 0.85rem;">All registered students already have certificates</span>
                ` : `
                    <button type="button" class="btn btn-secondary" onclick="credentialIssuerComponent.switchTab('students')">Register Students First</button>
                `}
            </div>
            <div id="directory-batch-progress" class="hidden" style="margin-top: 1rem; background: var(--bg-muted); padding: 1.25rem; border: 1px solid var(--border-medium); border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.5rem;">
                    <span id="directory-batch-progress-title">Preparing batch…</span>
                    <span id="directory-batch-progress-percent">0%</span>
                </div>
                <div style="width: 100%; height: 10px; background: var(--bg-surface); border-radius: 999px; overflow: hidden;">
                    <div id="directory-batch-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary) 0%, var(--accent-green) 100%); transition: width 0.2s ease;"></div>
                </div>
                <p id="directory-batch-progress-status" class="text-muted" style="font-size: 0.85rem; margin: 0.6rem 0 0;"></p>
            </div>
        `;
    },

    renderManualIssuanceHTML() {
        const students = window.studentManager ? window.studentManager.getAllStudents() : [];

        return `
            <!-- Web3 Attestation Status -->
            <div id="issuer-metamask-status" style="margin-bottom: 1.5rem;">
                ${this.renderMetaMaskStatusHTML(this.currentMetaMaskStatus)}
            </div>

            <form id="issue-credential-form" class="form-vertical" onsubmit="event.preventDefault(); credentialIssuerComponent.handlePreview()">
                <!-- Student Recipient & Academic Identity -->
                <div class="form-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div>
                            <h3 style="margin: 0;">Student Recipient & Identity</h3>
                            <p class="text-muted" style="margin: 0; font-size: 0.85rem;">Select student by Enrollment Number to automatically fetch all details without re-typing</p>
                        </div>
                        <button type="button" class="btn btn-secondary btn-small" onclick="credentialIssuerComponent.switchTab('students')">
                            + Enroll New Student in Directory
                        </button>
                    </div>

                    <!-- Primary Dropdown: Select Student by Enrollment Number -->
                    <div class="form-group" style="background: rgba(79, 45, 127, 0.06); padding: 1.1rem; border-radius: 10px; border: 1.5px solid var(--brand-purple); margin-bottom: 1.25rem;">
                        <label for="select-student-erno" style="font-weight: 700; color: var(--brand-purple); display: flex; align-items: center; justify-content: space-between; font-size: 0.95rem; margin-bottom: 0.5rem;">
                            <span>Select Student by Enrollment Number *</span>
                            <span class="badge badge-info" style="font-size: 0.75rem;">${students.length} Enrolled in Registry</span>
                        </label>
                        <select id="select-student-erno" class="select-student-dropdown form-control" onchange="credentialIssuerComponent.onSelectStudentChange(this.value)" 
                                style="width: 100%; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--brand-purple); background: var(--bg-surface); font-size: 0.95rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                            <option value="" style="background: var(--bg-surface); color: var(--text-primary);">${students.length > 0 ? `-- Select Student Enrollment Number (${students.length} Enrolled) --` : '-- No registered students found (Register students in Step 1) --'}</option>
                            ${students.map(s => `
                                <option value="${s.enrollmentNo}" ${this.selectedStudentErno === s.enrollmentNo ? 'selected' : ''} style="background: var(--bg-surface); color: var(--text-primary);">
                                    ${s.enrollmentNo} — ${s.name} (${s.email})
                                </option>
                            `).join('')}
                        </select>

                        <div id="student-fetch-badge" style="margin-top: 0.75rem; display: ${this.selectedStudentErno ? 'block' : 'none'};">
                            <div style="background: rgba(5, 150, 105, 0.1); border: 1px solid rgba(5, 150, 105, 0.3); padding: 0.5rem 0.85rem; border-radius: 6px; font-size: 0.84rem; color: var(--accent-green); display: flex; align-items: center; justify-content: space-between;">
                                <span>✓ Student profile auto-fetched from registry. No extra typing required!</span>
                            </div>
                        </div>
                    </div>

                    <!-- Auto-Fetched Student Fields Grid -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="student-prn">Enrollment Number (Erno.) *</label>
                            <input type="text" id="student-prn" placeholder="Select a registered student" required readonly style="text-transform: uppercase;" />
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="student-name">Student Full Name *</label>
                            <input type="text" id="student-name" placeholder="Auto-fetched on selection" required readonly />
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="student-email">Student Email Address *</label>
                            <input type="email" id="student-email" placeholder="Auto-fetched on selection" required readonly />
                            <small class="text-muted" style="font-size: 0.75rem;">Loaded from the registered student profile</small>
                        </div>
                    </div>

                    <div class="form-group">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; flex-wrap:wrap; gap:0.5rem;">
                            <label for="student-did" style="margin-bottom:0;">Student Decentralized Identifier (DID) *</label>
                        </div>
                        <input type="text" id="student-did" placeholder="Auto-filled from the registered student" required readonly />
                        <small id="student-did-hint">DID is assigned during Step 1 registration.</small>
                    </div>
                </div>

                <!-- Academic Information -->
                <div class="form-section">
                    <h3>Degree Program & Institutional Records</h3>
                    
                    <div class="form-group">
                        <label for="institution">Awarding Institution *</label>
                        <input type="text" id="institution" value="MIT Art, Design and Technology University, Pune" placeholder="MIT Art, Design and Technology University, Pune" required />
                    </div>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="degree">Degree Program *</label>
                            <input type="text" id="degree" placeholder="Bachelor of Technology in Computer Science & Engineering" value="B.Tech Computer Science & Engineering" required />
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label for="gpa-input">Cumulative GPA / CGPA (10-Point Scale)</label>
                            <input type="number" id="gpa-input" step="0.01" min="0" max="10" placeholder="Auto-calculated or from CSV" />
                            <small class="text-muted" style="font-size: 0.75rem;">Imported from CSV or auto-calculated from courses</small>
                        </div>
                    </div>
                </div>

                <!-- Courses -->
                <div class="form-section">
                    <div class="section-header">
                        <div>
                            <h3>Academic Courses & 10-Point Grade Points</h3>
                            <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 0;">Grade Scale: O (10), A+ (9), A (8), B+ (7), B (6), C (5), P (4), F (0)</p>
                        </div>
                        <button type="button" class="btn btn-secondary btn-small" onclick="credentialIssuerComponent.addCourse()">
                            + Add Course
                        </button>
                    </div>

                    <div id="courses-container">
                        <!-- Courses added dynamically -->
                    </div>
                </div>

                <div class="button-group">
                    <button type="button" class="btn btn-secondary" onclick="credentialIssuerComponent.switchTab('students')">
                        ← Back to Students
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Review Official Credential Preview →
                    </button>
                </div>
            </form>
        `;
    },

    renderHistoryTabHTML() {
        return `
            <div class="card">
                <div class="section-header">
                    <div>
                        <h2>Issued Certificates</h2>
                        <p class="text-muted">Permanent historical registry of authentic academic degrees issued by MIT-ADT University. Once issued, academic certificates are cryptographically sealed and cannot be deleted.</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button onclick="credentialIssuerComponent.loadHistory()" class="btn btn-small btn-secondary">Refresh</button>
                    </div>
                </div>
                
                ${this.issuedCredentials.length > 0 ? `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Issuance Date</th>
                                    <th>Student Name</th>
                                    <th>Degree Program</th>
                                    <th>CGPA</th>
                                    <th>Digital Signature</th>
                                    <th>Verification Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="history-table-body">
                                ${this.renderHistoryRows()}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state text-center" style="padding: 3rem 1rem;">
                        <h3>No Credentials Issued Yet</h3>
                        <p class="text-muted">Enroll a student in Step 1, then issue their degree in Step 2.</p>
                        <button class="btn btn-primary" onclick="credentialIssuerComponent.switchTab('students')" style="margin-top: 1rem;">
                            1️⃣ Go to Student Directory
                        </button>
                    </div>
                `}
            </div>
        `;
    },

    onSelectStudentChange(erno) {
        const nameInput = document.getElementById('student-name');
        const prnInput = document.getElementById('student-prn');
        const emailInput = document.getElementById('student-email');
        const didInput = document.getElementById('student-did');
        const degreeInput = document.getElementById('degree');
        const institutionInput = document.getElementById('institution');
        const gpaInput = document.getElementById('gpa-input');
        const badge = document.getElementById('student-fetch-badge');

        if (!erno) {
            this.selectedStudentErno = '';
            if (badge) badge.style.display = 'none';
            return;
        }

        const student = window.studentManager?.getStudentByEnrollment(erno);
        if (!student) return;

        this.selectedStudentErno = student.enrollmentNo;

        if (nameInput) {
            nameInput.value = student.name;
            nameInput.readOnly = true;
        }
        if (prnInput) {
            prnInput.value = student.enrollmentNo;
            prnInput.readOnly = true;
        }
        if (emailInput) {
            emailInput.value = student.email || '';
            emailInput.readOnly = true;
        }
        if (didInput) {
            didInput.value = student.did || '';
            didInput.readOnly = true;
        }
        if (institutionInput && student.institution) {
            institutionInput.value = student.institution;
        }
        if (degreeInput && student.program) {
            degreeInput.value = student.program;
        }
        if (gpaInput) {
            if (student.gpa !== undefined && student.gpa !== null && student.gpa !== '') {
                gpaInput.value = student.gpa;
            } else if (Array.isArray(student.courses) && student.courses.length > 0 && window.credentialManager) {
                gpaInput.value = window.credentialManager.calculateGPA(student.courses);
            } else {
                gpaInput.value = '';
            }
        }
        if (Array.isArray(student.courses) && student.courses.length > 0) {
            this.courses = student.courses.map((course, index) => ({
                id: Date.now() + index,
                courseName: course.courseName || course.subject || '',
                grade: course.grade || this.markToGrade(course.marks),
                marks: course.marks ?? this.gradeToMarks(course.grade),
                credits: course.credits || 4,
                year: course.year || student.graduationYear || new Date().getFullYear()
            }));
            this.renderCourses();
        }

        if (badge) {
            badge.style.display = 'block';
            const courseCount = Array.isArray(student.courses) ? student.courses.length : 0;
            const gpaInfo = student.gpa ? ` · GPA: ${student.gpa}` : '';
            badge.innerHTML = `
                <div style="background: rgba(5, 150, 105, 0.1); border: 1px solid rgba(5, 150, 105, 0.3); padding: 0.5rem 0.85rem; border-radius: 6px; font-size: 0.84rem; color: var(--accent-green); display: flex; align-items: center; justify-content: space-between;">
                    <span>✓ Auto-fetched student details for <strong>${student.name}</strong> (${student.enrollmentNo}) — ${courseCount} course(s) detected${gpaInfo}</span>
                </div>
            `;
        }

        window.app?.showSuccess(`✓ Auto-fetched profile for ${student.name} (${student.enrollmentNo})`);
    },

    async init() {
        this.courses = [];
        this.addCourse();
        await this.loadHistory();
        await this.loadProvisionedStudents();

        // Non-blocking background check for MetaMask to ensure the UI renders instantaneously
        this.initMetaMask().catch(err => {
            console.warn('MetaMask status check deferred:', err.message);
        });

        if (this.activeTab === 'history') {
            this.switchTab('history');
        } else if (this.activeTab === 'students') {
            this.switchTab('students');
        } else if (this.activeTab === 'issue') {
            this.switchTab('issue');
        }
    },

    async initMetaMask() {
        if (window.web3Signer) {
            this.currentMetaMaskStatus = await window.web3Signer.getStatus();
            this.updateStatusUI(this.currentMetaMaskStatus);

            window.web3Signer.onStateChange(status => {
                this.currentMetaMaskStatus = status;
                this.updateStatusUI(status);
            });
        }
    },

    renderMetaMaskStatusHTML(status) {
        if (!status) {
            return `
                <div class="metamask-status-bar">
                    <div class="metamask-status-info">
                        <span class="metamask-label">Blockchain Signature:</span>
                        <span class="metamask-state">Checking wallet status...</span>
                    </div>
                </div>
            `;
        }

        if (!status.available) {
            return `
                <div class="metamask-status-bar" style="border-left: 4px solid var(--accent-amber);">
                    <div class="metamask-status-info">
                        <span class="metamask-label">Blockchain Signature:</span>
                        <span class="metamask-state" style="color: var(--accent-amber);">MetaMask not detected (ECDSA DID signature will be used)</span>
                    </div>
                </div>
            `;
        }

        if (!status.connected) {
            return `
                <div class="metamask-status-bar">
                    <div class="metamask-status-info">
                        <span class="metamask-label">Blockchain Signature:</span>
                        <span class="metamask-state" style="color: var(--text-tertiary);">Disconnected</span>
                    </div>
                    <button type="button" class="btn btn-small btn-primary" onclick="credentialIssuerComponent.connectMetaMask()">
                        Connect MetaMask
                    </button>
                </div>
            `;
        }

        if (!status.isSepolia) {
            return `
                <div class="metamask-status-bar" style="border-left: 4px solid var(--accent-amber);">
                    <div class="metamask-status-info">
                        <span class="metamask-label">Blockchain Signature:</span>
                        <span class="metamask-state">Connected <code>${status.formattedAddress}</code></span>
                        <span class="badge badge-warning">Wrong Network (${status.chainId || 'Unknown'})</span>
                    </div>
                    <button type="button" class="btn btn-small btn-secondary" onclick="credentialIssuerComponent.switchNetwork()">
                        Switch to Sepolia
                    </button>
                </div>
            `;
        }

        return `
            <div class="metamask-status-bar" style="border-left: 4px solid var(--accent-green);">
                <div class="metamask-status-info">
                    <span class="metamask-label">Blockchain Signature:</span>
                    <span class="metamask-state">Connected <code class="did-code-small">${status.formattedAddress}</code> · Sepolia Testnet</span>
                    <span class="badge badge-success"><span class="badge-dot"></span> Ready for EIP-712 Signing</span>
                </div>
            </div>
        `;
    },

    updateStatusUI(status) {
        const container = document.getElementById('issuer-metamask-status');
        if (container) {
            container.innerHTML = this.renderMetaMaskStatusHTML(status);
        }
        const modalStatus = document.getElementById('modal-metamask-status');
        if (modalStatus) {
            modalStatus.innerHTML = this.renderMetaMaskStatusHTML(status);
        }
    },

    async connectMetaMask() {
        try {
            if (!window.web3Signer) throw new Error("Web3 signer module is not loaded.");
            await window.web3Signer.connect();
            await window.web3Signer.ensureSepolia();
            this.currentMetaMaskStatus = await window.web3Signer.getStatus();
            this.updateStatusUI(this.currentMetaMaskStatus);
            window.app.showSuccess("Connected to MetaMask on Sepolia testnet");
        } catch (error) {
            window.app.showError(error.message);
        }
    },

    async switchNetwork() {
        try {
            if (!window.web3Signer) return;
            await window.web3Signer.ensureSepolia();
            this.currentMetaMaskStatus = await window.web3Signer.getStatus();
            this.updateStatusUI(this.currentMetaMaskStatus);
            window.app.showSuccess("Switched to Sepolia testnet");
        } catch (error) {
            window.app.showError(error.message);
        }
    },

    switchTab(tab) {
        this.activeTab = tab;
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.render();
            if (tab === 'issue') {
                this.renderCourses();
                this.updateStatusUI(this.currentMetaMaskStatus);
                if (this.selectedStudentErno) {
                    this.onSelectStudentChange(this.selectedStudentErno);
                }
            } else if (tab === 'students') {
                this.loadProvisionedStudents();
                this.initStudentImportListeners();
            }
        }
    },

    /* ==========================================================================
       UNIVERSITY STUDENT DID GENERATION
       ========================================================================== */

    /**
     * University creates a new student DID directly inside the single issuance form
     */
    async generateStudentDIDForForm() {
        const nameInput = document.getElementById('student-name');
        const studentName = nameInput ? nameInput.value.trim() : '';

        if (!studentName) {
            window.app?.showError("Please enter the student's full name first to generate their DID.");
            nameInput?.focus();
            return;
        }

        try {
            window.app?.showLoading();
            // University generates the DID for student
            const studentDIDRecord = await window.didManager.createDID(studentName, { makeActive: false });

            const didInput = document.getElementById('student-did');
            if (didInput) {
                didInput.value = studentDIDRecord.id;
            }

            const hint = document.getElementById('student-did-hint');
            if (hint) {
                hint.innerHTML = `<span style="color:var(--accent-green); font-weight:600;">✓ Generated and registered W3C DID for ${studentName}</span>`;
            }

            // If PRN and Email are also filled, register or update student in student registry
            const prnInput = document.getElementById('student-prn');
            const emailInput = document.getElementById('student-email');
            const studentPRN = prnInput ? prnInput.value.trim().toUpperCase() : '';
            const studentEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';

            if (studentPRN && studentEmail && window.studentManager) {
                let existing = window.studentManager.getStudentByEnrollment(studentPRN);
                if (!existing) {
                    await window.studentManager.enrollStudent({
                        enrollmentNo: studentPRN,
                        email: studentEmail,
                        name: studentName,
                        did: studentDIDRecord.id
                    });
                } else {
                    existing.did = studentDIDRecord.id;
                    await window.studentManager.updateStudent(existing);
                }
                this.selectedStudentErno = studentPRN;
                const dropdown = document.getElementById('select-student-erno');
                if (dropdown) {
                    const opt = document.createElement('option');
                    opt.value = studentPRN;
                    opt.text = `${studentPRN} — ${studentName} (${studentEmail})`;
                    dropdown.appendChild(opt);
                    dropdown.value = studentPRN;
                }
            }

            window.app?.hideLoading();
            window.app?.showSuccess(`✓ Student DID generated for ${studentName}!`);
            await this.loadProvisionedStudents();

        } catch (err) {
            window.app?.hideLoading();
            console.error('Failed to generate student DID:', err);
            window.app?.showError('Failed to generate student DID: ' + err.message);
        }
    },

    /**
     * University Student Enrollment & Provisioning Tab (Dedicated Directory & DID Generator)
     */
    renderStudentsTabHTML() {
        const students = window.studentManager ? window.studentManager.getAllStudents() : [];
        const pendingStudents = students.filter(s => !this.isCertificateIssuedForStudent(s));

        return `
            <div class="card">
                <div class="section-header">
                    <div>
                        <h2>Student Digital Identity & Portal Enrollment</h2>
                        <p class="text-muted">Enroll student accounts by Enrollment Number (Erno.) and Email, generate W3C DIDs, and dispatch initial login credentials to students.</p>
                    </div>
                </div>

                <!-- Registration & Enrollment Form -->
                <div style="background: var(--bg-muted); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="margin-top: 0; font-size: 1.15rem; color: var(--text-primary); margin-bottom: 1rem;">
                        Enroll New Student and Generate Decentralized Identity (DID)
                    </h3>
                    <form id="provision-student-form" class="form-vertical" onsubmit="event.preventDefault(); credentialIssuerComponent.handleEnrollStudent();">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="prov-student-name">Student Full Name *</label>
                                <input type="text" id="prov-student-name" placeholder="e.g., Rohit Shelot" required />
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="prov-student-erno">Enrollment Number (Erno.) *</label>
                                <input type="text" id="prov-student-erno" placeholder="e.g., MIT2027CS042" required style="text-transform: uppercase;" />
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="prov-student-email">Student Email Address *</label>
                                <input type="email" id="prov-student-email" placeholder="e.g., student.name@mitadt.edu.in" required />
                                <small class="text-muted" style="font-size: 0.75rem;">Student's personal/university email (credentials sent here)</small>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="prov-student-degree">Degree Program</label>
                                <input type="text" id="prov-student-degree" value="B.Tech Computer Science & Engineering" placeholder="Program" />
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="prov-student-year">Graduation Year</label>
                                <input type="number" id="prov-student-year" value="2027" placeholder="Year" />
                            </div>
                        </div>

                        <div style="margin-top: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                            <button type="submit" class="btn btn-primary" id="btn-provision-submit" style="padding: 0.65rem 1.25rem; font-weight: 600;">
                                Generate DID and Enroll Student
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Bulk registration belongs here: it provisions DIDs before any certificate is issued. -->
                <div style="background: var(--bg-muted); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 1.5rem; margin-bottom: 2rem;">
                    <div class="section-header" style="margin-bottom: 1rem;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem;">Import Students and Generate DIDs</h3>
                            <p class="text-muted" style="margin: 0.35rem 0 0;">Upload a CSV once to register students. Each new record receives a DID and retains imported subjects, grades/marks, and CGPA for Step 2.</p>
                        </div>
                        <button type="button" class="btn btn-secondary btn-small" onclick="credentialIssuerComponent.downloadStudentEnrollmentTemplate()">Download CSV Template</button>
                    </div>
                    <div class="file-drop-area" id="student-import-drop-zone" role="button" tabindex="0" aria-busy="false" onclick="if (!this.classList.contains('is-loading')) document.getElementById('student-import-file-input').click()">
                        <div class="csv-upload-content">
                            <h3>Drag & Drop Student CSV File Here</h3>
                            <p class="text-muted" style="margin-bottom: 1rem;">Required columns: studentName, enrollmentNo, email. Supported academic columns: courses, gpa/CGPA, degree, institution, graduationYear.</p>
                            <button type="button" class="btn btn-primary btn-small">Browse Computer for CSV File</button>
                        </div>
                        <div class="csv-upload-loading" aria-live="polite">
                            <span class="csv-upload-spinner" aria-hidden="true"></span>
                            <div>
                                <strong id="student-import-status-title">Registering students…</strong>
                                <p id="student-import-status-detail">Generating DIDs and saving directory records. Please wait.</p>
                            </div>
                        </div>
                        <input type="file" id="student-import-file-input" accept=".csv, text/csv, text/plain" style="display:none;" onchange="credentialIssuerComponent.handleStudentImportFile(event)">
                    </div>
                    ${this.studentImportResults.length > 0 ? `
                        <p class="text-muted" style="margin: 1rem 0 0;">Latest import: <strong>${this.studentImportResults.filter(r => r.status === 'registered').length}</strong> registered, <strong>${this.studentImportResults.filter(r => r.status === 'skipped').length}</strong> skipped, <strong>${this.studentImportResults.filter(r => r.status === 'failed').length}</strong> failed.</p>
                    ` : ''}
                </div>

                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                    <div>
                        <h3>Enrolled Student Directory (${students.length})</h3>
                        <p class="text-muted" style="margin: 0.35rem 0 0;">Manage enrolled students and identities. Pending students can be deleted; once an academic certificate is issued, it cannot be deleted.</p>
                    </div>
                    ${pendingStudents.length > 0 ? `
                        <button type="button" class="btn btn-danger btn-small" onclick="credentialIssuerComponent.openDeleteAllStudentsModal()" title="Delete all pending enrolled students">
                            Delete Pending (${pendingStudents.length})
                        </button>
                    ` : ''}
                </div>

                ${students.length > 0 ? `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Enrollment No (Erno.)</th>
                                    <th>Student Name</th>
                                    <th>Email ID</th>
                                    <th>Assigned DID</th>
                                    <th>Degree Certificate</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${students.map(s => {
                                    const isIssued = this.isCertificateIssuedForStudent(s);

                                    return `
                                    <tr>
                                        <td><span class="badge badge-success" style="font-size:0.78rem;">${s.enrollmentNo}</span></td>
                                        <td><strong>${s.name}</strong><br><small class="text-muted">${s.program || ''}${s.gpa ? ` · CGPA: ${s.gpa}` : ''}${Array.isArray(s.courses) && s.courses.length > 0 ? ` · ${s.courses.length} courses` : ''}</small></td>
                                        <td><a href="mailto:${s.email}" style="color:var(--primary); font-size:0.85rem;">${s.email}</a></td>
                                        <td><code class="did-code-small" title="${s.did}">${s.did ? (s.did.substring(0, 14) + '...' + s.did.substring(s.did.length - 8)) : 'Pending'}</code></td>
                                        <td>
                                            ${isIssued 
                                                ? `<span class="badge badge-success" style="font-size:0.75rem;">Issued (Active)</span>` 
                                                : `<span class="badge badge-warning" style="font-size:0.75rem;">Pending Issuance</span>`
                                            }
                                        </td>
                                        <td style="white-space: nowrap;">
                                            <button class="btn btn-small btn-secondary" onclick="credentialIssuerComponent.showStudentEmailNotice('${s.enrollmentNo}')" title="View Dispatched Email">
                                                Email
                                            </button>
                                            <button class="btn btn-small btn-secondary" onclick="credentialIssuerComponent.resendStudentCredentials('${s.enrollmentNo}')" title="Email a new temporary password">
                                                Resend Credentials
                                            </button>
                                            <button class="btn btn-small btn-secondary" onclick="credentialIssuerComponent.showStudentIdentityCard('${s.did}')" title="Identity QR">
                                                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3m3 0v3m-6 3h3m3 0h3m-6-3h3m-3-3h3" /></svg>
                                            </button>
                                            ${isIssued 
                                                ? `<button class="btn btn-small btn-secondary" onclick="credentialIssuerComponent.viewStudentCredential('${s.did}', '${s.enrollmentNo}')" title="View Issued Certificate">View Degree</button>
                                                   <span class="badge badge-success" style="font-size:0.72rem; margin-left:4px;" title="Official certificate issued. Permanent record.">Permanent</span>`
                                                : `<button class="btn btn-small btn-primary" onclick="credentialIssuerComponent.prefillCredentialForStudent('${s.did}', '${s.name}', '${s.enrollmentNo}')" title="Review and issue this student's degree">Review & Issue</button>
                                                   <button class="btn btn-small btn-danger" onclick="credentialIssuerComponent.deleteStudent(decodeURIComponent('${encodeURIComponent(s.enrollmentNo)}'))" title="Delete pending student">
                                                       <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" /></svg>
                                                   </button>`
                                            }
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state text-center" style="padding: 2.5rem 1rem;">
                        <p class="text-muted">No student identities provisioned yet. Use the form above to enroll students.</p>
                    </div>
                `}
            </div>
        `;
    },

    async loadProvisionedStudents() {
        if (window.studentManager) {
            await window.studentManager.refreshStudents();
            this.provisionedStudents = window.studentManager.getAllStudents();
        } else {
            this.provisionedStudents = [];
        }
    },

    async handleEnrollStudent() {
        const nameInput = document.getElementById('prov-student-name');
        const ernoInput = document.getElementById('prov-student-erno');
        const emailInput = document.getElementById('prov-student-email');
        const degreeInput = document.getElementById('prov-student-degree');
        const yearInput = document.getElementById('prov-student-year');

        const studentName = nameInput ? nameInput.value.trim() : '';
        const enrollmentNo = ernoInput ? ernoInput.value.trim().toUpperCase() : '';
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const program = degreeInput ? degreeInput.value.trim() : 'B.Tech Computer Science & Engineering';
        const graduationYear = yearInput ? yearInput.value : 2027;

        if (!studentName || !enrollmentNo || !email) {
            window.app?.showError("Student Name, Enrollment Number, and Email Address are all required.");
            return;
        }

        try {
            window.app?.showLoading();

            const result = await window.studentManager.enrollStudent({
                enrollmentNo,
                email,
                name: studentName,
                program,
                graduationYear
            });

            window.app?.hideLoading();
            if (result.emailDelivered) window.app?.showSuccess(result.emailPreview
                ? `✓ Student ${studentName} stored in MongoDB. Email preview mode is active.`
                : `✓ Student ${studentName} enrolled! Credentials dispatched to ${email}`);

            if (!result.emailDelivered) {
                window.app?.showError(`Student ${studentName} was enrolled, but credentials were not emailed. ${result.emailPreviewReason || result.emailError || 'Configure Gmail SMTP, then enroll again.'}`);
            }

            await this.loadProvisionedStudents();
            this.switchTab('students');


        } catch (err) {
            window.app?.hideLoading();
            console.error('Enrollment error:', err);
            window.app?.showError('Failed to enroll student: ' + err.message);
        }
    },

    /* ======================================================================
       DIRECTORY CSV IMPORT — registration and DID provisioning happen here,
       before a registrar can issue any credential.
       ====================================================================== */
    initStudentImportListeners() {
        const dropZone = document.getElementById('student-import-drop-zone');
        if (!dropZone || dropZone.dataset.listenersBound) return;
        dropZone.dataset.listenersBound = 'true';

        ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => {
            event.preventDefault();
            event.stopPropagation();
            dropZone.classList.add('drag-active');
        }));
        ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => {
            event.preventDefault();
            event.stopPropagation();
            dropZone.classList.remove('drag-active');
        }));
        dropZone.addEventListener('drop', event => {
            if (dropZone.classList.contains('is-loading')) return;
            const file = event.dataTransfer?.files?.[0];
            if (file) this.importStudentsFromCSV(file);
        });
    },

    handleStudentImportFile(event) {
        const file = event.target.files?.[0];
        if (file) this.importStudentsFromCSV(file);
    },

    setStudentImportLoading(isLoading, title = '', detail = '') {
        const dropZone = document.getElementById('student-import-drop-zone');
        const input = document.getElementById('student-import-file-input');
        const titleEl = document.getElementById('student-import-status-title');
        const detailEl = document.getElementById('student-import-status-detail');
        if (dropZone) {
            dropZone.classList.toggle('is-loading', isLoading);
            dropZone.setAttribute('aria-busy', String(isLoading));
        }
        if (input) input.disabled = isLoading;
        if (title && titleEl) titleEl.textContent = title;
        if (detail && detailEl) detailEl.textContent = detail;
    },

    downloadStudentEnrollmentTemplate() {
        const csv = 'studentDID,studentName,enrollmentNo,email,degree,institution,courses,gpa\nauto,Rohit Shelot,MIT2027CS042,rohitshelotmitadt@gmail.com,B.Tech Computer Science & Engineering,MIT Art Design and Technology University Pune,"Mathematics-I:A:4:2027;Data Structures:O:4:2027;Database Systems:A+:4:2027",9.2\nauto,Ritesh Shelot,MIT2027CS043,riteshshelot48@gmail.com,B.Tech Computer Science & Engineering,MIT Art Design and Technology University Pune,"Mathematics-I:A:4:2027;Data Structures:O:4:2027",9.1\nauto,Keshav More,MIT2027IT041,dev.rohitshelot@gmail.com,B.Tech Information Technology,MIT Art Design and Technology University Pune,"Web Technologies:O:4:2027;Software Engineering:A+:4:2027",8.9\nauto,Sakshi Atole,MIT2027ME025,atolesakshi10@gmail.com,B.Tech Mechanical Engineering,MIT Art Design and Technology University Pune,"Thermodynamics:A+:4:2027;CAD/CAM:O:4:2027",8.7\nauto,Aparna Shelot,MIT2027CS044,aparnashelot75@gmail.com,B.Tech Computer Science & Engineering,MIT Art Design and Technology University Pune,"Mathematics-I:A+:4:2027;Data Structures:O:4:2027;Database Systems:A:4:2027",9.3\n';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mit_adt_student_credentials_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    gradeToMarks(grade) {
        const marks = { 'O': 100, 'A+': 90, 'A': 80, 'B+': 70, 'B': 60, 'C': 50, 'P': 40, 'F': 0 };
        return marks[String(grade || '').trim().toUpperCase()] ?? null;
    },

    markToGrade(mark) {
        const value = Number(mark);
        if (!Number.isFinite(value)) return '';
        if (value >= 90) return 'O';
        if (value >= 80) return 'A+';
        if (value >= 70) return 'A';
        if (value >= 60) return 'B+';
        if (value >= 50) return 'B';
        if (value >= 40) return 'C';
        return 'F';
    },

    parseAcademicCourses(rawCourses, fallbackYear) {
        if (!rawCourses) return [];
        const items = String(rawCourses).trim();
        const separator = items.includes(';') ? ';' : (items.includes(':') && items.includes(',') ? ',' : ';');
        return items.split(separator).map(value => value.trim()).filter(Boolean).map(value => {
            const parts = value.split(':').map(part => part.trim());
            const subject = parts[0] || '';
            const gradeOrMarks = parts[1] || 'A';
            const credits = parts[2] || 4;
            const year = parts[3] || fallbackYear;

            const numericMarks = Number(gradeOrMarks);
            const grade = Number.isFinite(numericMarks) ? this.markToGrade(numericMarks) : String(gradeOrMarks || '').toUpperCase();
            return {
                courseName: subject,
                subject,
                grade: grade || 'A',
                marks: Number.isFinite(numericMarks) ? numericMarks : this.gradeToMarks(grade),
                credits: Number(credits) || 4,
                year: Number.parseInt(year, 10) || fallbackYear || 2027
            };
        }).filter(course => course.courseName);
    },

    async importStudentsFromCSV(file) {
        if (this.isStudentImporting) return;
        if (!window.studentManager) {
            window.app?.showError('Student directory is not available. Please refresh and sign in again.');
            return;
        }

        this.isStudentImporting = true;
        this.setStudentImportLoading(true, 'Reading student CSV…', 'Validating directory records.');

        try {
            const rows = this.parseCSVText(await file.text());
            if (rows.length < 2) throw new Error('The CSV must have a header row and at least one student record.');

            const headers = rows[0].map(header => this.normalizeCSVHeader(header));
            const indexOf = names => headers.findIndex(header => names.includes(header));
            const didIndex = indexOf(['studentdid', 'did', 'recipientdid', 'id']);
            const nameIndex = indexOf(['studentname', 'name', 'fullname']);
            const enrollmentIndex = indexOf(['enrollmentno', 'erno', 'prn', 'studentprn']);
            const emailIndex = indexOf(['email', 'studentemail']);
            const programIndex = indexOf(['degreeprogram', 'degree', 'program']);
            const yearIndex = indexOf(['graduationyear', 'year']);
            const institutionIndex = indexOf(['institution', 'university']);
            const coursesIndex = indexOf(['courses', 'courselist', 'subjects', 'subjectmarks']);
            const gpaIndex = indexOf(['gpa', 'cgpa']);

            if (nameIndex === -1 || enrollmentIndex === -1 || emailIndex === -1) {
                throw new Error('CSV must include studentName, enrollmentNo, and email column headers.');
            }

            await window.studentManager.refreshStudents();
            const seenEnrollments = new Set();
            const results = [];
            const records = rows.slice(1).filter(row => row.some(value => String(value || '').trim()));

            for (let index = 0; index < records.length; index++) {
                const row = records[index];
                const rawDid = didIndex === -1 ? '' : String(row[didIndex] || '').trim();
                const did = (!rawDid || rawDid.toLowerCase() === 'auto') ? null : rawDid;
                const name = String(row[nameIndex] || '').trim();
                const enrollmentNo = String(row[enrollmentIndex] || '').trim().toUpperCase();
                const email = String(row[emailIndex] || '').trim().toLowerCase();
                const program = programIndex === -1 ? 'B.Tech Computer Science & Engineering' : String(row[programIndex] || '').trim() || 'B.Tech Computer Science & Engineering';
                
                let graduationYear = yearIndex === -1 ? null : Number.parseInt(row[yearIndex], 10);
                const institution = institutionIndex === -1 ? 'MIT Art, Design and Technology University, Pune' : String(row[institutionIndex] || '').trim() || 'MIT Art, Design and Technology University, Pune';
                const courses = coursesIndex === -1 ? [] : this.parseAcademicCourses(row[coursesIndex], graduationYear || 2027);
                
                if (!graduationYear && courses.length > 0) {
                    const courseYears = courses.map(c => Number(c.year)).filter(y => Number.isFinite(y) && y > 2000);
                    if (courseYears.length > 0) graduationYear = Math.max(...courseYears);
                }
                if (!graduationYear) graduationYear = 2027;

                let parsedGpa = gpaIndex === -1 ? null : Number.parseFloat(row[gpaIndex]);
                if ((!Number.isFinite(parsedGpa) || parsedGpa === null) && courses.length > 0) {
                    try {
                        parsedGpa = Number.parseFloat(window.credentialManager.calculateGPA(courses));
                    } catch (e) {
                        parsedGpa = null;
                    }
                }
                const gpa = Number.isFinite(parsedGpa) ? parsedGpa : null;

                this.setStudentImportLoading(true, `Registering student ${index + 1} of ${records.length}…`, name || `CSV row ${index + 2}`);

                if (!name || !enrollmentNo || !email.includes('@')) {
                    results.push({ status: 'failed', enrollmentNo, name, error: 'Name, enrollment number, and valid email are required.' });
                    continue;
                }
                if (seenEnrollments.has(enrollmentNo)) {
                    results.push({ status: 'skipped', enrollmentNo, name, error: 'Duplicate enrollment number in this CSV.' });
                    continue;
                }
                seenEnrollments.add(enrollmentNo);

                const existingStudent = window.studentManager.getStudentByEnrollment(enrollmentNo);
                if (existingStudent) {
                    if (this.isCertificateIssuedForStudent(existingStudent)) {
                        results.push({ status: 'skipped', enrollmentNo, name, error: 'Certificate already issued for this student.' });
                        continue;
                    }
                    try {
                        await window.studentManager.updateStudent({
                            ...existingStudent,
                            name: name || existingStudent.name,
                            email: email || existingStudent.email,
                            program: program || existingStudent.program,
                            institution: institution || existingStudent.institution,
                            graduationYear: graduationYear || existingStudent.graduationYear,
                            courses: courses.length > 0 ? courses : (existingStudent.courses || []),
                            gpa: gpa !== null ? gpa : (existingStudent.gpa ?? null)
                        });
                        results.push({
                            status: 'registered',
                            enrollmentNo,
                            name,
                            did: existingStudent.did,
                            courseCount: (courses.length > 0 ? courses : (existingStudent.courses || [])).length,
                            emailDelivered: false,
                            updated: true
                        });
                        continue;
                    } catch (error) {
                        results.push({ status: 'failed', enrollmentNo, name, error: error.message || 'Unable to update student profile.' });
                        continue;
                    }
                }

                try {
                    const result = await window.studentManager.enrollStudent({
                        name, enrollmentNo, email, program, graduationYear, institution, courses,
                        gpa, did
                    });
                    results.push({ status: 'registered', enrollmentNo, name, did: result.student.did, courseCount: courses.length, emailDelivered: result.emailDelivered });
                } catch (error) {
                    results.push({ status: 'failed', enrollmentNo, name, error: error.message || 'Unable to register student.' });
                }
            }

            this.studentImportResults = results;
            const registered = results.filter(result => result.status === 'registered').length;
            const failed = results.filter(result => result.status === 'failed').length;
            await this.loadProvisionedStudents();
            this.switchTab('students');
            if (registered) window.app?.showSuccess(`✓ ${registered} student record${registered === 1 ? '' : 's'} imported with subjects, GPA, and DIDs. Proceed to Step 2 to review & issue certificates!`);
            if (failed) window.app?.showError(`${failed} CSV record${failed === 1 ? '' : 's'} could not be registered. Check the import summary.`);
        } catch (error) {
            console.error('Student CSV import error:', error);
            window.app?.showError('Student CSV import failed: ' + error.message);
        } finally {
            this.isStudentImporting = false;
            this.setStudentImportLoading(false);
        }
    },

    showStudentEmailNotice(enrollmentNo) {
        if (!window.studentManager) return;
        const emails = window.studentManager.getDispatchedEmails();
        const found = emails.find(e => e.data?.enrollmentNo?.toUpperCase() === enrollmentNo?.toUpperCase());
        if (found) {
            window.studentManager.showEmailModal(found);
        } else {
            const student = window.studentManager.getStudentByEnrollment(enrollmentNo);
            if (student) {
                const simulated = window.studentManager.dispatchEnrollmentEmail(student);
                window.studentManager.showEmailModal(simulated);
            }
        }
    },

    async resendStudentCredentials(enrollmentNo) {
        if (!window.api?.resendStudentCredentials) {
            window.app?.showError('Credential delivery service is unavailable.');
            return;
        }
        try {
            window.app?.showLoading();
            const result = await window.api.resendStudentCredentials(enrollmentNo);
            window.app?.hideLoading();
            window.app?.showSuccess(result.message);
        } catch (error) {
            window.app?.hideLoading();
            window.app?.showError(`Credentials were not resent: ${error.message}`);
        }
    },

    async deleteStudent(enrollmentNo) {
        if (!window.studentManager) return;

        const student = window.studentManager.getStudentByEnrollment(enrollmentNo);
        if (student && this.isCertificateIssuedForStudent(student)) {
            window.app?.showError(`Cannot delete student ${enrollmentNo}: An official academic certificate has already been issued for this student. Once a certificate is issued, it becomes a permanent record and cannot be deleted.`);
            return;
        }

        const name = student?.name || enrollmentNo;
        if (!window.confirm(`Delete ${name} (${enrollmentNo}) from the student directory? This action cannot be undone.`)) {
            return;
        }

        try {
            window.app?.showLoading();
            await window.studentManager.deleteStudent(enrollmentNo);
            this.provisionedStudents = window.studentManager.getAllStudents();
            window.app?.hideLoading();
            window.app?.showSuccess(`Student ${enrollmentNo} was deleted.`);
            this.switchTab(this.activeTab);
        } catch (error) {
            window.app?.hideLoading();
            window.app?.showError(`Student could not be deleted: ${error.message}`);
        }
    },

    openDeleteAllStudentsModal() {
        if (!window.studentManager) return;

        const allStudents = window.studentManager.getAllStudents();
        const pendingStudents = allStudents.filter(s => !this.isCertificateIssuedForStudent(s));
        if (pendingStudents.length === 0) {
            window.app?.showInfo('No pending students to delete. Students with issued certificates cannot be deleted.');
            return;
        }

        const message = document.getElementById('delete-all-students-message');
        const modal = document.getElementById('delete-all-students-modal');
        if (message) message.textContent = `Delete all ${pendingStudents.length} pending enrolled student record${pendingStudents.length === 1 ? '' : 's'}? Students with issued certificates are protected and cannot be deleted.`;
        if (modal) modal.classList.remove('hidden');
    },

    cancelDeleteAllStudents() {
        document.getElementById('delete-all-students-modal')?.classList.add('hidden');
    },

    async confirmDeleteAllStudents() {
        const allStudents = window.studentManager?.getAllStudents() || [];
        const pendingStudents = allStudents.filter(s => !this.isCertificateIssuedForStudent(s));
        if (pendingStudents.length === 0) {
            this.cancelDeleteAllStudents();
            return;
        }

        try {
            this.cancelDeleteAllStudents();
            window.app?.showLoading();
            let deletedCount = 0;
            for (const s of pendingStudents) {
                try {
                    await window.studentManager.deleteStudent(s.enrollmentNo);
                    deletedCount++;
                } catch (err) {
                    console.error(`Failed to delete ${s.enrollmentNo}:`, err);
                }
            }
            this.provisionedStudents = window.studentManager.getAllStudents();
            window.app?.hideLoading();
            window.app?.showSuccess(`${deletedCount} pending student record${deletedCount === 1 ? '' : 's'} deleted.`);
            this.switchTab(this.activeTab);
        } catch (error) {
            window.app?.hideLoading();
            window.app?.showError(`Students could not be deleted: ${error.message}`);
        }
    },

    viewStudentCredential(didString, enrollmentNo) {
        const found = this.issuedCredentials.find(c => 
            c.credentialSubject?.id === didString || 
            (enrollmentNo && (
                c.credentialSubject?.enrollmentNo?.toUpperCase() === enrollmentNo.toUpperCase() ||
                c.credentialSubject?.prn?.toUpperCase() === enrollmentNo.toUpperCase()
            ))
        );
        if (found) {
            this.showCredentialQR(found.id);
        } else {
            window.app?.showWarning('No issued degree found for this student. Use Step 2 to issue all pending certificates.');
        }
    },

    showStudentIdentityCard(didString) {
        let student = this.provisionedStudents.find(s => s.id === didString || s.did === didString);
        if (!student && window.studentManager) {
            student = window.studentManager.getStudentByDID(didString);
        }
        if (!student) return;

        const displayName = student.name || student.alias || 'Student';
        const displayPRN = student.enrollmentNo || student.prn || '';

        window.qrHelper.showQRModal({
            title: 'MIT-ADT Student Digital Identity Card',
            subtitle: `${displayName} ${displayPRN ? `• Erno: ${displayPRN}` : ''}`,
            data: student.did || student.id,
            type: 'did',
            downloadFilename: `student-did-${displayName.toLowerCase().replace(/\\s+/g, '-')}.png`
        });
    },

    prefillCredentialForStudent(didString, studentName, enrollmentNo) {
        this.selectedStudentErno = enrollmentNo;
        this.certificateIssuanceMode = 'individual';
        this.switchTab('issue');
        setTimeout(() => {
            const dropdown = document.getElementById('select-student-erno');
            if (dropdown && enrollmentNo) {
                dropdown.value = enrollmentNo;
            }
            this.onSelectStudentChange(enrollmentNo);
        }, 100);
    },

    scanStudentDID() {
        if (!window.qrHelper) {
            window.app?.showError("QR scanner is not available");
            return;
        }

        window.qrHelper.openScannerModal({
            title: 'Scan Student Identity QR Code',
            description: 'Scan student wallet DID from phone screen or student ID card',
            filter: 'did',
            onScan: (scannedText) => {
                const input = document.getElementById('student-did');
                if (input) {
                    input.value = scannedText;
                    window.app?.showSuccess('✓ Student DID auto-filled from QR Code!');
                }
            }
        });
    },

    getDefaultBatchCourses(graduationYear) {
        const year = Number.parseInt(graduationYear, 10) || new Date().getFullYear();
        return [
            { courseName: 'Core Engineering Mathematics', grade: 'A', credits: 4, year },
            { courseName: 'Advanced Data Structures & Algorithms', grade: 'O', credits: 4, year },
            { courseName: 'Operating Systems & Distributed Networks', grade: 'A+', credits: 4, year }
        ];
    },

    async issueAllRegisteredStudentCertificates() {
        if (this.isDirectoryBatchIssuing) return;
        if (!window.studentManager || !window.credentialManager) {
            window.app?.showError('The student directory or credential service is unavailable.');
            return;
        }

        await this.loadHistory();
        const pendingStudents = window.studentManager.getAllStudents()
            .filter(student => student.did && !this.isCertificateIssuedForStudent(student));
        if (pendingStudents.length === 0) {
            window.app?.showToast('Every registered student already has a certificate.', 'info');
            this.switchTab('issue');
            return;
        }

        if (!confirm(`Issue signed degree certificates to all ${pendingStudents.length} pending student${pendingStudents.length === 1 ? '' : 's'}? Existing certificates will not be changed.`)) {
            return;
        }

        const button = document.getElementById('btn-issue-all-student-certificates');
        const progressBox = document.getElementById('directory-batch-progress');
        const progressBar = document.getElementById('directory-batch-progress-bar');
        const progressPercent = document.getElementById('directory-batch-progress-percent');
        const progressTitle = document.getElementById('directory-batch-progress-title');
        const progressStatus = document.getElementById('directory-batch-progress-status');
        const successfulIssues = [];
        const failedIssues = [];

        this.isDirectoryBatchIssuing = true;
        if (button) button.disabled = true;
        if (progressBox) progressBox.classList.remove('hidden');

        try {
            for (let index = 0; index < pendingStudents.length; index++) {
                const student = pendingStudents[index];
                const current = index + 1;
                const percent = Math.round((current / pendingStudents.length) * 100);
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressPercent) progressPercent.textContent = `${percent}%`;
                if (progressTitle) progressTitle.textContent = `Issuing certificate ${current} of ${pendingStudents.length}`;
                if (progressStatus) progressStatus.textContent = `Signing certificate for ${student.name} (${student.enrollmentNo})…`;

                try {
                    const studentCourses = Array.isArray(student.courses) && student.courses.length > 0
                        ? student.courses.map((course, idx) => ({
                            courseName: course.courseName || course.subject || `Course ${idx + 1}`,
                            grade: course.grade || 'A',
                            credits: parseFloat(course.credits) || 4,
                            year: parseInt(course.year) || student.graduationYear || new Date().getFullYear()
                        }))
                        : this.getDefaultBatchCourses(student.graduationYear);

                    const credential = await window.credentialManager.issueCredential({
                        studentDID: student.did,
                        studentName: student.name,
                        studentPRN: student.enrollmentNo,
                        studentEmail: student.email,
                        institution: student.institution || 'MIT Art, Design and Technology University, Pune',
                        degree: student.program || 'Academic Degree Program',
                        courses: studentCourses,
                        gpa: (student.gpa !== undefined && student.gpa !== null && student.gpa !== '') ? parseFloat(student.gpa) : undefined
                    }, {
                        // One DID-signed batch avoids a MetaMask approval for each student.
                        skipEthereumProof: true
                    });
                    window.studentManager.dispatchCredentialEmail(student, credential);
                    successfulIssues.push(student);
                } catch (error) {
                    console.error(`Failed to issue certificate for ${student.enrollmentNo}:`, error);
                    failedIssues.push({ student, error });
                }
            }

            await this.loadHistory();
            if (progressTitle) progressTitle.textContent = 'Batch issuance complete';
            if (progressStatus) progressStatus.textContent = `${successfulIssues.length} certificate(s) issued; ${failedIssues.length} failed.`;

            if (successfulIssues.length) {
                window.app?.showSuccess(`${successfulIssues.length} student certificate${successfulIssues.length === 1 ? '' : 's'} issued successfully.`);
            }
            if (failedIssues.length) {
                window.app?.showError(`${failedIssues.length} student certificate${failedIssues.length === 1 ? '' : 's'} could not be issued. You can run the batch again; completed certificates are skipped.`);
            }
            this.switchTab('history');
        } catch (error) {
            console.error('Directory batch issuance failed:', error);
            window.app?.showError('Unable to complete batch certificate issuance: ' + (error.message || error));
        } finally {
            this.isDirectoryBatchIssuing = false;
            if (button) button.disabled = false;
        }
    },

    addCourse() {
        const courseId = Date.now();
        this.courses.push({ id: courseId, courseName: '', grade: 'A', credits: 4, year: 2027 });
        this.renderCourses();
    },

    removeCourse(courseId) {
        this.courses = this.courses.filter(c => c.id !== courseId);
        if (this.courses.length === 0) {
            this.addCourse();
        } else {
            this.renderCourses();
        }
    },

    renderCourses() {
        const container = document.getElementById('courses-container');
        if (!container) return;

        container.innerHTML = this.courses.map(course => `
            <div class="course-item" id="course-${course.id}">
                <div class="course-fields">
                    <div class="form-group">
                        <label>Course Name *</label>
                        <input type="text" class="course-name" value="${course.courseName || ''}" oninput="credentialIssuerComponent.updateCourse(${course.id}, 'courseName', this.value)" placeholder="e.g., Mathematics-I" required />
                    </div>
                    <div class="form-group">
                        <label>Grade (10-Pt Scale) *</label>
                        <select class="course-grade" onchange="credentialIssuerComponent.updateCourse(${course.id}, 'grade', this.value)" required>
                            <option value="">Select</option>
                            ${['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F'].map(g => `<option value="${g}" ${course.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Credits *</label>
                        <input type="number" class="course-credits" value="${course.credits || ''}" oninput="credentialIssuerComponent.updateCourse(${course.id}, 'credits', this.value)" placeholder="4" min="1" max="10" step="0.5" required />
                    </div>
                    <div class="form-group">
                        <label>Year *</label>
                        <input type="number" class="course-year" value="${course.year || '2027'}" oninput="credentialIssuerComponent.updateCourse(${course.id}, 'year', this.value)" placeholder="2027" min="2020" max="2030" required />
                    </div>
                </div>
                <button type="button" class="btn-icon-danger" onclick="credentialIssuerComponent.removeCourse(${course.id})" title="Remove course">
                    <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" /></svg>
                </button>
            </div>
        `).join('');
    },

    updateCourse(id, field, value) {
        const course = this.courses.find(c => c.id === id);
        if (course) {
            course[field] = value;
        }
    },

    async loadHistory() {
        const activeDID = window.didManager.activeDID?.id;
        if (!activeDID) return;

        if (!window.api?.getIssuedCredentials) {
            throw new Error('MongoDB API is not available.');
        }
        this.issuedCredentials = await window.api.getIssuedCredentials(activeDID);
        await window.credentialManager.importCredentials(this.issuedCredentials);

        if (this.activeTab === 'history') {
            const tbody = document.getElementById('history-table-body');
            if (tbody) {
                if (this.issuedCredentials.length > 0) {
                    tbody.innerHTML = this.renderHistoryRows();
                } else {
                    this.switchTab('history');
                }
            }
        }
    },

    renderHistoryRows() {
        return this.issuedCredentials.map(cred => {
            const gpa = cred.credentialSubject.gpa || 'N/A';
            const scale = cred.credentialSubject.gpaScale || 10;
            const ethSigner = cred.ethereumProof?.signerAddress;
            const shortEthSigner = ethSigner ? (window.web3Signer?.formatAddress(ethSigner) || ethSigner) : 'None';

            return `
                <tr>
                    <td>${new Date(cred.issuanceDate).toLocaleDateString()}</td>
                    <td><strong>${cred.credentialSubject.name}</strong></td>
                    <td>${cred.credentialSubject.degree}</td>
                    <td><span class="badge badge-info">${gpa}/${scale}</span></td>
                    <td>${ethSigner ? `<code class="did-code-small" title="${ethSigner}">${shortEthSigner}</code>` : '<span class="badge badge-success">DID ECDSA</span>'}</td>
                    <td><span class="badge badge-success"><span class="badge-dot"></span> Issued</span></td>
                    <td>
                        <button class="btn btn-small btn-secondary" onclick="credentialIssuerComponent.showCredentialQR('${cred.id}')" title="Show QR Code">
                            <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3m3 0v3m-6 3h3m3 0h3m-6-3h3m-3-3h3" /></svg>
                            <span>QR Code</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    showCredentialQR(credentialId) {
        const cred = this.issuedCredentials.find(c => c.id === credentialId) || window.credentialManager.getCredential(credentialId);
        if (!cred) {
            window.app?.showError('Credential record not found');
            return;
        }

        window.qrHelper.showQRModal({
            title: 'Verifiable Academic Credential QR',
            subtitle: `${cred.credentialSubject.name} • ${cred.credentialSubject.degree}`,
            data: window.qrHelper.createCredentialReference(cred),
            type: 'credential',
            downloadFilename: `credential-${cred.credentialSubject.name.toLowerCase().replace(/\\s+/g, '-')}.png`
        });
    },

    handlePreview() {
        const studentDID = document.getElementById('student-did').value.trim();
        const studentName = document.getElementById('student-name').value.trim();
        const studentPRN = document.getElementById('student-prn') ? document.getElementById('student-prn').value.trim().toUpperCase() : '';
        const studentEmail = document.getElementById('student-email') ? document.getElementById('student-email').value.trim().toLowerCase() : '';
        const institution = document.getElementById('institution').value.trim();
        const degree = document.getElementById('degree').value.trim();

        const registeredStudent = this.selectedStudentErno && window.studentManager?.getStudentByEnrollment(this.selectedStudentErno);
        if (!registeredStudent || registeredStudent.did !== studentDID) {
            window.app.showError('Select a registered student from the directory before issuing a certificate.');
            return;
        }
        if (this.isCertificateIssuedForStudent(registeredStudent)) {
            window.app.showError('This student already has an issued certificate.');
            return;
        }

        if (!studentDID || !studentName || !institution || !degree) {
            window.app.showError('Please fill in all required fields');
            return;
        }

        if (!studentPRN) {
            window.app.showError('Please enter the Student Enrollment Number (Erno.)');
            document.getElementById('student-prn')?.focus();
            return;
        }

        if (!studentEmail) {
            window.app.showError('Please enter the Student Email Address');
            document.getElementById('student-email')?.focus();
            return;
        }

        const validCourses = this.courses.filter(c => c.courseName && c.grade && c.credits && c.year);
        if (validCourses.length === 0) {
            window.app.showError('Please add at least one complete course with name, grade, and credits');
            return;
        }

        let coursesData = [];
        try {
            coursesData = validCourses.map(c => ({
                courseName: c.courseName,
                grade: c.grade,
                credits: parseFloat(c.credits),
                year: parseInt(c.year)
            }));
            const gpaInput = document.getElementById('gpa-input');
            const gpaVal = gpaInput && gpaInput.value.trim() !== '' ? parseFloat(gpaInput.value.trim()) : null;
            const gpa = (gpaVal !== null && !isNaN(gpaVal)) ? gpaVal : window.credentialManager.calculateGPA(coursesData);
            this.pendingIssuanceData = {
                studentDID,
                studentName,
                studentPRN,
                studentEmail,
                prn: studentPRN,
                enrollmentNo: studentPRN,
                email: studentEmail,
                institution,
                degree,
                courses: coursesData,
                gpa
            };
        } catch (error) {
            window.app.showError('Invalid course data: ' + error.message);
            return;
        }

        const modal = document.getElementById('preview-modal');
        const content = document.getElementById('preview-content');

        const ethStatus = this.currentMetaMaskStatus;
        const signerText = ethStatus?.connected && ethStatus?.isSepolia
            ? `Connected: ${ethStatus.account} (Sepolia)`
            : 'MetaMask will prompt to connect & sign on Sepolia';

        content.innerHTML = `
            <div id="modal-metamask-status" style="margin-bottom: 1.25rem;">
                ${this.renderMetaMaskStatusHTML(ethStatus)}
            </div>

            <div class="credential-card credential-preview-certificate" style="cursor: default; transform: none;">
                <div class="cert-header">
                    <img src="assets/mit-adt-logo.png" alt="MIT-ADT University" class="cert-logo" />
                    <div class="cert-title-block">
                        <h3>${institution}</h3>
                        <p class="cert-subtitle">Official Verifiable Academic Credential</p>
                    </div>
                    <span class="badge badge-info cert-badge">SPECIMEN</span>
                </div>

                <div class="credential-detail-section">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Student Full Name</label>
                            <p style="font-size: 1.1rem; color: var(--primary); font-weight: 700;">${studentName}</p>
                        </div>
                        <div class="detail-item">
                            <label>Enrollment Number (Erno.)</label>
                            <p style="font-weight: 600;"><span class="badge badge-success">${studentPRN}</span></p>
                        </div>
                        <div class="detail-item">
                            <label>Student Email ID</label>
                            <p style="color: var(--primary); font-weight: 600;">${studentEmail}</p>
                        </div>
                        <div class="detail-item">
                            <label>Degree Program</label>
                            <p>${degree}</p>
                        </div>
                        <div class="detail-item">
                            <label>Calculated CGPA</label>
                            <p style="font-size: 1.2rem; color: var(--brand-gold);"><strong>${this.pendingIssuanceData.gpa} / 10</strong></p>
                        </div>
                        <div class="detail-item">
                            <label>Student Recipient DID</label>
                            <code class="did-code-small">${studentDID}</code>
                        </div>
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <label>Ethereum Issuer Signer (Sepolia Testnet)</label>
                            <p style="font-size: 0.9rem; font-weight: 500; color: var(--text-secondary);">${signerText}</p>
                        </div>
                    </div>
                </div>

                <div class="credential-detail-section">
                    <h3>Course Breakdown & Grade Points</h3>
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
                                ${this.pendingIssuanceData.courses.map(c => `
                                    <tr>
                                        <td><strong>${c.courseName}</strong></td>
                                        <td><span class="badge badge-info">${c.grade}</span></td>
                                        <td>${c.credits}</td>
                                        <td>${c.year}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    closePreview() {
        document.getElementById('preview-modal').classList.add('hidden');
    },

    async submitIssuance() {
        const signButton = document.getElementById('btn-sign-issue');
        const originalButtonHTML = signButton ? signButton.innerHTML : 'Authorize & Issue Credential';

        try {
            if (signButton) {
                signButton.disabled = true;
                signButton.innerHTML = '⏳ Attesting & Signing Credential...';
            }

            const selectedStudent = window.studentManager?.getStudentByEnrollment(this.pendingIssuanceData?.studentPRN);
            if (!selectedStudent || selectedStudent.did !== this.pendingIssuanceData?.studentDID) {
                throw new Error('The selected student is no longer registered. Return to Step 1 and register the student first.');
            }

            const credential = await window.credentialManager.issueCredential(this.pendingIssuanceData);

            // Ensure student is registered/enrolled in studentManager so they can log in via Erno or Email immediately!
            if (window.studentManager) {
                const targetDID = credential.credentialSubject?.id || this.pendingIssuanceData?.studentDID;
                const studentEmail = this.pendingIssuanceData?.studentEmail || credential.credentialSubject?.email;
                const studentPRN = this.pendingIssuanceData?.studentPRN || credential.credentialSubject?.enrollmentNo || credential.credentialSubject?.prn;
                const studentName = this.pendingIssuanceData?.studentName || credential.credentialSubject?.name;
                const studentDegree = this.pendingIssuanceData?.degree || credential.credentialSubject?.degree;

                let student = (studentPRN ? window.studentManager.getStudentByEnrollment(studentPRN) : null) || 
                              (studentEmail ? window.studentManager.getStudentByEmail(studentEmail) : null) ||
                              window.studentManager.getStudentByDID(targetDID);

                if (!student) {
                    throw new Error('Certificate recipients must be registered in the student directory first.');
                } else if (student) {
                    let changed = false;
                    if (studentEmail && student.email !== studentEmail) {
                        student.email = studentEmail;
                        changed = true;
                    }
                    if (targetDID && student.did !== targetDID) {
                        student.did = targetDID;
                        changed = true;
                    }
                    if (studentName && student.name !== studentName) {
                        student.name = studentName;
                        changed = true;
                    }
                    if (changed) student = await window.studentManager.updateStudent(student) || student;
                }

                if (student) {
                    if (studentEmail) student.email = studentEmail;
                    const emailLog = window.studentManager.dispatchCredentialEmail(student, credential);
                    window.app.showSuccess(`✓ Degree attested and dispatched to student email: ${student.email}`);
                    window.studentManager.showEmailModal(emailLog);
                }
            }

            this.closePreview();
            window.app.showSuccess('✓ Official Academic Credential issued and attested successfully!');

            await this.loadHistory();
            this.switchTab('history');

            this.pendingIssuanceData = null;
            this.courses = [];
            this.addCourse();

        } catch (error) {
            console.error('Issuance error:', error);
            window.app.showError('Issuance failed: ' + (error.message || error));
        } finally {
            if (signButton) {
                signButton.disabled = false;
                signButton.innerHTML = originalButtonHTML;
            }
        }
    },

    async deleteCredential(id) {
        window.app?.showError('Action disallowed: Issued academic degree certificates are permanent verifiable records and cannot be deleted once issued.');
    },

    async deleteAllIssuedCredentials() {
        window.app?.showError('Action disallowed: Issued academic degree certificates are permanent verifiable records and cannot be deleted once issued.');
    },

    /* ==========================================================================
       REGISTRAR BATCH CSV IMPORT
       ========================================================================== */

    renderBatchContentHTML() {
        const students = this.csvParsedStudents || [];
        const validCount = students.filter(s => s.isValid).length;
        const autoDidCount = students.filter(s => s.isValid && s.needsDIDGeneration).length;
        const errorCount = students.filter(s => !s.isValid).length;

        return `
            <div class="card">
                <div class="section-header">
                    <div>
                        <h2>Registrar Bulk CSV Academic Import</h2>
                        <p class="text-muted">Import student records, then review the university-generated DIDs before issuing certificates.</p>
                    </div>
                    <button type="button" class="btn btn-secondary btn-small" onclick="credentialIssuerComponent.downloadCSVTemplate()">
                    Download CSV Template
                    </button>
                </div>

                <!-- Upload Drag-Drop Box -->
                <div class="file-drop-area" id="csv-drop-zone" role="button" tabindex="0" aria-busy="false" onclick="if (!this.classList.contains('is-loading')) document.getElementById('csv-file-input').click()">
                    <div class="csv-upload-content">
                        <h3>Drag & Drop Student Academic CSV File Here</h3>
                        <p class="text-muted" style="margin-bottom: 1rem;">Required columns: studentName, enrollmentNo, email, and degree.</p>
                        <button type="button" class="btn btn-primary btn-small">
                            Browse Computer for CSV File
                        </button>
                    </div>
                    <div class="csv-upload-loading" aria-live="polite">
                        <span class="csv-upload-spinner" aria-hidden="true"></span>
                        <div>
                            <strong id="csv-upload-status-title">Reading CSV file…</strong>
                            <p id="csv-upload-status-detail">Validating student records. Please wait.</p>
                        </div>
                    </div>
                    <input type="file" id="csv-file-input" accept=".csv, text/csv, text/plain" style="display:none;" onchange="credentialIssuerComponent.handleCSVFileSelected(event)">
                </div>

                <!-- Batch Processing Configuration -->
                <div class="batch-options-card" style="margin-top: 1.5rem; background: var(--bg-muted); border-radius: 12px; padding: 1.25rem;">
                    <h3 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 1.05rem;">Batch Issuance Settings</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="batch-auto-create-missing-did" checked disabled />
                            <span><strong>University DID Provisioning Active</strong> (Missing student DIDs are securely generated during CSV import)</span>
                        </label>
                        <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="batch-auto-register-did" checked />
                            <span><strong>Auto-register student DIDs in University registry</strong> (Ensures immediate validity without pre-registration)</span>
                        </label>
                        <div style="margin-top: 0.5rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">Attestation Mode</label>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                                <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="radio" name="batch-sign-mode" value="fast" checked />
                                    <span><strong>Standard Batch Processing (W3C DID ECDSA Key)</strong> - Recommended for large cohorts</span>
                                </label>
                                <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="radio" name="batch-sign-mode" value="metamask" />
                                    <span><strong>Dual Attestation (MetaMask Sepolia + DID)</strong> - Prompts MetaMask for each record</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Parsed Results Table -->
                ${students.length > 0 ? `
                    <div style="margin-top: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
                            <div style="display: flex; gap: 0.75rem; align-items: center;">
                                <span class="badge badge-info">Total Records: ${students.length}</span>
                                <span class="badge badge-success">Ready to Issue: ${validCount}</span>
                                ${autoDidCount > 0 ? `<span class="badge badge-warning">University Will Generate DID: ${autoDidCount}</span>` : ''}
                                ${errorCount > 0 ? `<span class="badge badge-danger">Errors: ${errorCount}</span>` : ''}
                            </div>
                            <button type="button" class="btn btn-secondary btn-small" onclick="credentialIssuerComponent.clearBatchData()">
                                Clear Batch
                            </button>
                        </div>

                        <!-- Progress Bar Box -->
                        <div id="batch-progress-box" class="hidden" style="margin-bottom: 1.5rem; background: var(--bg-surface); padding: 1.25rem; border: 1px solid var(--border-medium); border-radius: 12px;">
                            <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.5rem;">
                                <span id="batch-progress-title">Processing academic batch...</span>
                                <span id="batch-progress-percent">0%</span>
                            </div>
                            <div style="width: 100%; height: 10px; background: var(--bg-muted); border-radius: 999px; overflow: hidden;">
                                <div id="batch-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary) 0%, var(--accent-green) 100%); transition: width 0.2s ease;"></div>
                            </div>
                            <p id="batch-progress-status" class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem; margin-bottom: 0;">Initializing batch pipeline...</p>
                        </div>

                        <!-- Preview Table -->
                        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Student Name</th>
                                        <th>Student DID</th>
                                        <th>Degree Program</th>
                                        <th>CGPA</th>
                                        <th>Validation Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${students.map((s, idx) => `
                                        <tr style="${!s.isValid ? 'background: rgba(220, 38, 38, 0.05);' : ''}">
                                            <td>${idx + 1}</td>
                                            <td><strong>${s.studentName || '<em class="text-muted">Missing</em>'}</strong></td>
                                            <td>
                                                ${s.studentDID && s.studentDID !== 'auto'
                                                    ? `<code class="did-code-small" title="${s.studentDID}">${s.studentDID.substring(0, 15)}...${s.studentDID.substring(s.studentDID.length - 6)}</code>`
                                                    : `<span class="badge badge-warning">University Will Create DID</span>`
                                                }
                                            </td>
                                            <td>${s.degree || '<em class="text-muted">Missing</em>'}</td>
                                            <td><span class="badge badge-info">${s.gpa || 'Calculated'}/10</span></td>
                                            <td>
                                                ${s.isValid 
                                                    ? `<span class="badge badge-success"><span class="badge-dot"></span> Validated</span>`
                                                    : `<span class="badge badge-danger">${s.errorMessage || 'Invalid'}</span>`
                                                }
                                            </td>
                                            <td>
                                                <button type="button" class="btn-icon-danger" onclick="credentialIssuerComponent.removeBatchRow(${idx})" title="Remove row">
                                                    <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Execute Button -->
                        <div class="modal-actions" style="margin-top: 1.5rem; justify-content: flex-end;">
                            <button type="button" id="btn-execute-batch" class="btn btn-primary btn-large" onclick="credentialIssuerComponent.executeBatchIssuance()" ${validCount === 0 ? 'disabled' : ''}>
                                Issue All ${validCount} Degrees
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    initBatchUploadListeners() {
        const dropZone = document.getElementById('csv-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(name => {
            dropZone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(name => {
            dropZone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-active');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            if (dropZone.classList.contains('is-loading')) return;
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.parseCSVFile(files[0]);
            }
        });
    },

    handleCSVFileSelected(event) {
        const file = event.target.files?.[0];
        if (file) {
            this.parseCSVFile(file);
        }
    },

    setCSVUploadLoading(isLoading, fileName = '') {
        const dropZone = document.getElementById('csv-drop-zone');
        if (!dropZone) return;

        const fileInput = document.getElementById('csv-file-input');
        const browseButton = dropZone.querySelector('button');
        const title = document.getElementById('csv-upload-status-title');
        const detail = document.getElementById('csv-upload-status-detail');

        dropZone.classList.toggle('is-loading', isLoading);
        dropZone.setAttribute('aria-busy', String(isLoading));

        if (fileInput) {
            fileInput.disabled = isLoading;
            if (!isLoading) fileInput.value = '';
        }
        if (browseButton) browseButton.disabled = isLoading;

        if (isLoading) {
            if (title) title.textContent = 'Reading CSV file…';
            if (detail) detail.textContent = fileName
                ? 'Checking ' + fileName + ' and validating student records.'
                : 'Validating student records. Please wait.';
        }
    },

    updateCSVUploadStatus(titleText, detailText) {
        const title = document.getElementById('csv-upload-status-title');
        const detail = document.getElementById('csv-upload-status-detail');
        if (title) title.textContent = titleText;
        if (detail) detail.textContent = detailText;
    },

    async provisionParsedStudentDIDs(students) {
        const studentsNeedingDID = students.filter(student =>
            student.isValid && (!student.studentDID || student.studentDID === 'auto')
        );

        if (studentsNeedingDID.length === 0) return 0;

        if (!window.didManager?.createDID) {
            for (const student of studentsNeedingDID) {
                student.isValid = false;
                student.errorMessage = 'University DID service is unavailable';
            }
            return 0;
        }

        let generatedCount = 0;

        for (let i = 0; i < studentsNeedingDID.length; i++) {
            const student = studentsNeedingDID[i];
            this.updateCSVUploadStatus(
                'Generating university DIDs…',
                'Assigning DID ' + (i + 1) + ' of ' + studentsNeedingDID.length + ' to ' + student.studentName + '.'
            );

            try {
                // The registrar creates and stores each DID without replacing
                // the university administrator's active signing identity.
                const didRecord = await window.didManager.createDID(student.studentName, { makeActive: false });
                student.studentDID = didRecord.id;
                student.needsDIDGeneration = false;
                student.didGeneratedByUniversity = true;
                generatedCount++;
            } catch (error) {
                student.isValid = false;
                student.errorMessage = 'University DID generation failed: ' + error.message;
            }
        }

        return generatedCount;
    },

    downloadCSVTemplate() {
        const csvContent = 
`studentName,enrollmentNo,email,degree
Rohit Shelot,MIT2027CS042,student.rohit@mitadt.edu.in,B.Tech Computer Science & Engineering
Aarav Sharma,MIT2027CS043,aarav.sharma@mitadt.edu.in,B.Tech Computer Science & Engineering
Priya Patel,MIT2027IT041,priya.patel@mitadt.edu.in,B.Tech Information Technology
Rohan Deshmukh,MIT2027ME025,rohan.deshmukh@mitadt.edu.in,B.Tech Mechanical Engineering`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'mit_adt_student_credentials_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.app?.showSuccess('✓ Official CSV Template downloaded! Fill in student records and upload.');
    },

    async parseCSVFile(file) {
        this.setCSVUploadLoading(true, file.name);

        try {
            // Let the browser paint the in-place loading state before file parsing begins.
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const text = await file.text();
            const rows = this.parseCSVText(text);

            if (rows.length < 2) {
                window.app?.hideLoading();
                window.app?.showError("The CSV file must contain a header row and at least one student record.");
                return;
            }

            // Normalize common spreadsheet exports, including a UTF-8 BOM that Excel
            // can place before the first header and spaces, underscores, or hyphens.
            const header = rows[0].map(h => this.normalizeCSVHeader(h));
            const dataRows = rows.slice(1);

            const didIdx = header.findIndex(h => h === 'studentdid' || h === 'did' || h === 'recipientdid' || h === 'id');
            const nameIdx = header.findIndex(h => h === 'studentname' || h === 'name' || h === 'fullname');
            const enrollmentIdx = header.findIndex(h => h === 'enrollmentno' || h === 'erno' || h === 'prn' || h === 'studentprn');
            const emailIdx = header.findIndex(h => h === 'email' || h === 'studentemail');
            const degreeIdx = header.findIndex(h => h === 'degree' || h === 'degreeprogram' || h === 'program');
            const instIdx = header.findIndex(h => h === 'institution' || h === 'university');
            const coursesIdx = header.findIndex(h => h === 'courses' || h === 'courselist');
            const gpaIdx = header.findIndex(h => h === 'gpa' || h === 'cgpa');

            if (nameIdx === -1 || enrollmentIdx === -1 || emailIdx === -1 || degreeIdx === -1) {
                window.app?.hideLoading();
                window.app?.showError("CSV must include studentName, enrollmentNo, email, and degree column headers.");
                return;
            }

            const parsedStudents = [];

            for (let i = 0; i < dataRows.length; i++) {
                const r = dataRows[i];
                if (r.length === 0 || (r.length === 1 && !r[0].trim())) continue;

                let studentDID = didIdx !== -1 && r[didIdx] ? r[didIdx].trim() : 'auto';
                const studentName = r[nameIdx] ? r[nameIdx].trim() : '';
                const studentPRN = r[enrollmentIdx] ? r[enrollmentIdx].trim().toUpperCase() : '';
                const studentEmail = r[emailIdx] ? r[emailIdx].trim().toLowerCase() : '';
                const degree = r[degreeIdx] ? r[degreeIdx].trim() : '';
                const institution = instIdx !== -1 && r[instIdx] && r[instIdx].trim() 
                    ? r[instIdx].trim() 
                    : 'MIT Art, Design and Technology University, Pune';

                let courses = [];
                let gpa = gpaIdx !== -1 && r[gpaIdx] ? parseFloat(r[gpaIdx].trim()) : null;

                if (coursesIdx !== -1 && r[coursesIdx] && r[coursesIdx].trim()) {
                    const rawCoursesStr = r[coursesIdx].trim();
                    const courseItems = rawCoursesStr.split(';').map(c => c.trim()).filter(Boolean);
                    for (const item of courseItems) {
                        const parts = item.split(':').map(p => p.trim());
                        if (parts.length >= 2) {
                            courses.push({
                                courseName: parts[0],
                                grade: parts[1].toUpperCase(),
                                credits: parts[2] ? parseFloat(parts[2]) : 4,
                                year: parts[3] ? parseInt(parts[3]) : 2027
                            });
                        }
                    }
                }

                if (courses.length === 0) {
                    courses = [
                        { courseName: 'Core Engineering Mathematics', grade: 'A', credits: 4, year: 2027 },
                        { courseName: 'Advanced Data Structures & Algorithms', grade: 'O', credits: 4, year: 2027 },
                        { courseName: 'Operating Systems & Distributed Networks', grade: 'A+', credits: 4, year: 2027 }
                    ];
                }

                if (!gpa && courses.length > 0) {
                    try {
                        gpa = parseFloat(window.credentialManager.calculateGPA(courses));
                    } catch(e) {
                        gpa = 8.5;
                    }
                }

                let isValid = true;
                let errorMessage = '';
                const needsDIDGeneration = !studentDID || studentDID === 'auto';

                if (!studentName) {
                    isValid = false;
                    errorMessage = 'Student name is missing';
                } else if (!studentPRN) {
                    isValid = false;
                    errorMessage = 'Enrollment number is missing';
                } else if (!studentEmail || !studentEmail.includes('@')) {
                    isValid = false;
                    errorMessage = 'Valid student email is missing';
                } else if (!degree) {
                    isValid = false;
                    errorMessage = 'Degree program is missing';
                } else if (!needsDIDGeneration && !studentDID.startsWith('did:')) {
                    isValid = false;
                    errorMessage = 'DID must start with did:';
                }

                parsedStudents.push({
                    studentDID,
                    studentName,
                    studentPRN,
                    studentEmail,
                    degree,
                    institution,
                    courses,
                    gpa: gpa || 8.5,
                    needsDIDGeneration,
                    isValid,
                    errorMessage
                });
            }

            await this.provisionParsedStudentDIDs(parsedStudents);
            this.csvParsedStudents = parsedStudents;
            window.app?.hideLoading();
            window.app?.showSuccess(`✓ Parsed ${parsedStudents.length} student records from CSV!`);
            this.issuanceSubMode = 'csv';
            this.switchTab('issue');

        } catch (error) {
            window.app?.hideLoading();
            console.error('CSV parse error:', error);
            window.app?.showError('Failed to parse CSV: ' + error.message);
        } finally {
            this.setCSVUploadLoading(false);
        }
    },

    parseCSVText(text) {
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let insideQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentField += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentRow.push(currentField);
                currentField = '';
            } else if ((char === '\r' || char === '\n') && !insideQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }

        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField);
            rows.push(currentRow);
        }

        return rows;
    },

    normalizeCSVHeader(header) {
        return String(header || '')
            .replace(/^\uFEFF/, '')
            .trim()
            .toLowerCase()
            .replace(/[\s_-]/g, '');
    },

    removeBatchRow(index) {
        if (this.csvParsedStudents && this.csvParsedStudents[index]) {
            this.csvParsedStudents.splice(index, 1);
            this.switchTab('issue');
        }
    },

    clearBatchData() {
        this.csvParsedStudents = [];
        this.switchTab('issue');
    },

    async executeBatchIssuance() {
        if (this.isBatchProcessing) {
            window.app?.showToast('Batch issuance is already in progress.', 'info');
            return;
        }

        const validStudents = this.csvParsedStudents.filter(s => s.isValid);
        if (validStudents.length === 0) {
            window.app?.showError("No valid student records to issue.");
            return;
        }

        const autoRegisterDID = document.getElementById('batch-auto-register-did')?.checked ?? true;
        const signModeRadio = document.querySelector('input[name="batch-sign-mode"]:checked');
        const isFastMode = signModeRadio ? signModeRadio.value === 'fast' : true;

        const confirmMsg = `Authorize and issue ${validStudents.length} official degree credentials? University will generate DIDs for students without one.`;
        if (!confirm(confirmMsg)) return;

        const btn = document.getElementById('btn-execute-batch');
        const progressBox = document.getElementById('batch-progress-box');
        const progressBar = document.getElementById('batch-progress-bar');
        const progressPercent = document.getElementById('batch-progress-percent');
        const progressTitle = document.getElementById('batch-progress-title');
        const progressStatus = document.getElementById('batch-progress-status');

        if (btn) btn.disabled = true;
        if (progressBox) progressBox.classList.remove('hidden');

        this.isBatchProcessing = true;
        const successfulIssues = [];
        const failedIssues = [];

        for (let i = 0; i < validStudents.length; i++) {
            const student = validStudents[i];
            const currentNum = i + 1;
            const pct = Math.round((currentNum / validStudents.length) * 100);

            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressPercent) progressPercent.textContent = `${pct}%`;
            if (progressTitle) progressTitle.textContent = `Attesting credential ${currentNum} of ${validStudents.length}`;
            if (progressStatus) progressStatus.textContent = `Generating DID and cryptographic attestation for ${student.studentName}...`;

            try {
                let targetDID = student.studentDID;
                if (!targetDID || targetDID === 'auto') {
                    // University creates DID for the student
                    const newDIDRecord = await window.didManager.createDID(student.studentName, { makeActive: false });
                    targetDID = newDIDRecord.id;
                    student.studentDID = targetDID;
                }

                if (autoRegisterDID) {
                    const existingRecord = await window.storageManager.get('dids', targetDID);
                    if (!existingRecord) {
                        await window.storageManager.save('dids', {
                            id: targetDID,
                            alias: student.studentName,
                            created: new Date().toISOString()
                        });
                    }
                }

                // Provision/update the student account before issuing, so the
                // recipient can sign in and retrieve the attested credential.
                if (window.studentManager) {
                    await window.studentManager.enrollStudent({
                        enrollmentNo: student.studentPRN,
                        email: student.studentEmail,
                        name: student.studentName,
                        program: student.degree,
                        did: targetDID
                    });
                }

                const cred = await window.credentialManager.issueCredential({
                    studentDID: targetDID,
                    studentName: student.studentName,
                    studentPRN: student.studentPRN,
                    studentEmail: student.studentEmail,
                    institution: student.institution,
                    degree: student.degree,
                    courses: student.courses,
                    gpa: student.gpa
                }, {
                    skipEthereumProof: isFastMode,
                    autoRegisterStudentDID: autoRegisterDID,
                    batchMode: true
                });

                // Dispatch notification email if student is enrolled in registry
                if (window.studentManager) {
                    const studentRecord = window.studentManager.getStudentByDID(targetDID);
                    if (studentRecord) {
                        window.studentManager.dispatchCredentialEmail(studentRecord, cred);
                    }
                }

                successfulIssues.push({
                    studentName: student.studentName,
                    enrollmentNo: student.studentPRN,
                    studentDID: targetDID,
                    degree: student.degree,
                    gpa: student.gpa,
                    credentialId: cred.id,
                    issuanceDate: cred.issuanceDate
                });

            } catch (err) {
                console.error(`Error issuing to ${student.studentName}:`, err);
                failedIssues.push({
                    studentName: student.studentName,
                    error: err.message
                });
            }

            await new Promise(r => setTimeout(r, 60));
        }

        this.isBatchProcessing = false;
        await this.loadHistory();
        await this.loadProvisionedStudents();

        if (progressBar) progressBar.style.width = `100%`;
        if (progressPercent) progressPercent.textContent = `100%`;
        if (progressTitle) progressTitle.textContent = `✓ Batch Processing Complete!`;
        if (progressStatus) {
            progressStatus.innerHTML = `Successfully attested <strong>${successfulIssues.length}</strong> academic degrees. (${failedIssues.length} failed).`;
        }

        this._lastBatchResults = successfulIssues;

        window.app?.showSuccess(`✓ Successfully issued ${successfulIssues.length} academic credentials!`);

        if (progressBox) {
            const reportBtn = document.createElement('div');
            reportBtn.style.marginTop = '1rem';
            reportBtn.innerHTML = `
                <button type="button" class="btn btn-primary" onclick="credentialIssuerComponent.downloadBatchReport()">
                    Download Batch Report (CSV)
                </button>
                <button type="button" class="btn btn-secondary" onclick="credentialIssuerComponent.switchTab('history')">
                    View Certificate Registry
                </button>
            `;
            progressBox.appendChild(reportBtn);
        }

        if (btn) btn.disabled = false;

        // Keep only unsuccessful rows in memory. Already-issued certificates can
        // never be submitted again from this batch if the user returns to import.
        const issuedEnrollmentNos = new Set(successfulIssues.map(item => item.enrollmentNo));
        this.csvParsedStudents = this.csvParsedStudents.filter(student =>
            !issuedEnrollmentNos.has(student.studentPRN)
        );

        if (failedIssues.length > 0) {
            window.app?.showToast(
                successfulIssues.length + ' certificates issued. ' + failedIssues.length + ' records remain for review.',
                'info'
            );
        }

        this.switchTab('history');
    },

    downloadBatchReport() {
        if (!this._lastBatchResults || this._lastBatchResults.length === 0) {
            window.app?.showError("No batch issuance records to download.");
            return;
        }

        let csv = "Student Name,Assigned Student DID,Degree Program,CGPA,Credential Attestation ID,Issuance Date\n";
        for (const item of this._lastBatchResults) {
            csv += `"${item.studentName}","${item.studentDID}","${item.degree}","${item.gpa}","${item.credentialId}","${item.issuanceDate}"\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `mit_adt_registrar_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.app?.showSuccess("Registrar report downloaded!");
    }
};

window.credentialIssuerComponent = credentialIssuerComponent;
