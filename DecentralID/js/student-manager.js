/**
 * Student Manager & Institutional Enrollment Engine
 * 
 * Manages student provisioning, Enrollment Number (Erno.) credentials,
 * email dispatch simulation, role-based access isolation, and password management.
 */
class StudentManager {
    constructor() {
        // This is only a render cache. Student records are read from and
        // written to MongoDB through window.api; nothing is persisted here.
        this.students = [];
        this.emailLogs = [];
    }

    async refreshStudents() {
        if (!window.api?.getEnrolledStudents) {
            throw new Error('MongoDB API is not available. Start the backend and sign in as the university.');
        }
        this.students = await window.api.getEnrolledStudents();
        return this.getAllStudents();
    }

    /**
     * Get all enrolled students
     */
    getAllStudents() {
        return [...this.students];
    }

    cacheStudent(student) {
        const index = this.students.findIndex(item =>
            item.enrollmentNo?.toUpperCase() === student.enrollmentNo?.toUpperCase()
        );
        if (index >= 0) this.students[index] = { ...this.students[index], ...student };
        else this.students.push(student);
        return this.students[index >= 0 ? index : this.students.length - 1];
    }

    /** Update MongoDB, then refresh the in-memory render cache. */
    async updateStudent(updatedStudent) {
        if (!updatedStudent?.enrollmentNo) return null;
        const saved = await window.api.updateStudent(updatedStudent.enrollmentNo, updatedStudent);
        return this.cacheStudent(saved);
    }

    /** Delete a student in MongoDB, then remove the matching cached record. */
    async deleteStudent(enrollmentNo) {
        if (!enrollmentNo) throw new Error('Enrollment Number is required.');
        if (!window.api?.deleteStudent) {
            throw new Error('MongoDB API is not available. Start the backend and sign in as the university.');
        }

        const result = await window.api.deleteStudent(enrollmentNo);
        const cleanEnrollment = enrollmentNo.trim().toUpperCase();
        this.students = this.students.filter(student =>
            student.enrollmentNo?.toUpperCase() !== cleanEnrollment
        );
        return result;
    }

    /** Delete every MongoDB-backed student account and clear local render state. */
    async deleteAllStudents() {
        if (!window.api?.deleteAllStudents) {
            throw new Error('MongoDB API is not available. Start the backend and sign in as the university.');
        }

        const studentsToDelete = this.getAllStudents();
        let result;
        try {
            result = await window.api.deleteAllStudents();
        } catch (error) {
            // Supports an already-running backend that has not yet been restarted
            // to load the bulk endpoint. The existing protected per-student route
            // provides the same authorized deletion behavior.
            if (error.status !== 404 || !window.api?.deleteStudent) throw error;

            await Promise.all(studentsToDelete.map(student =>
                window.api.deleteStudent(student.enrollmentNo)
            ));
            result = { success: true, deletedCount: studentsToDelete.length };
        }
        this.students = [];
        this.emailLogs = [];
        return result;
    }

    /**
     * Find student by Enrollment Number (Erno.)
     */
    getStudentByEnrollment(erno) {
        if (!erno) return null;
        const clean = erno.trim().toUpperCase();
        return this.getAllStudents().find(s => s.enrollmentNo.toUpperCase() === clean) || null;
    }

    /**
     * Find student by either Enrollment Number OR Email ID
     */
    getStudentByIdentifier(identifier) {
        if (!identifier) return null;
        const clean = identifier.trim();
        return this.getAllStudents().find(s => 
            s.enrollmentNo.toUpperCase() === clean.toUpperCase() || 
            (s.email && s.email.toLowerCase() === clean.toLowerCase())
        ) || null;
    }

    /**
     * Find student by registered email address
     */
    getStudentByEmail(email) {
        if (!email) return null;
        const clean = email.trim().toLowerCase();
        return this.getAllStudents().find(s => s.email && s.email.toLowerCase() === clean) || null;
    }

    /**
     * Find student by assigned DID
     */
    getStudentByDID(didString) {
        if (!didString) return null;
        return this.getAllStudents().find(s => s.did === didString) || null;
    }

    /**
     * University Admin Enrolls a Student
     * The backend generates and delivers the one-time password; it never enters
     * browser memory or an on-screen email preview.
     */
    async enrollStudent(data) {
        const cleanEnrollment = (data.enrollmentNo || '').trim().toUpperCase();
        const cleanEmail = (data.email || '').trim().toLowerCase();
        const studentName = (data.name || '').trim();

        if (!cleanEnrollment) throw new Error("Enrollment Number (Erno.) is required.");
        if (!cleanEmail) throw new Error("Student email address is required.");
        if (!studentName) throw new Error("Student full name is required.");

        // Create or derive student DID if not provided or set to 'auto'
        let studentDID = (data.did && data.did.trim().toLowerCase() !== 'auto') ? data.did.trim() : null;
        if (!studentDID && window.didManager) {
            // Do not replace the registrar's signing identity while provisioning a student.
            const didRec = await window.didManager.createDID(studentName, { makeActive: false });
            studentDID = didRec.id;
        }

        const student = {
            enrollmentNo: cleanEnrollment,
            email: cleanEmail,
            name: studentName,
            program: data.program || 'B.Tech Computer Science & Engineering',
            graduationYear: data.graduationYear || 2027,
            institution: data.institution || 'MIT Art, Design and Technology University, Pune',
            courses: Array.isArray(data.courses) ? data.courses : [],
            gpa: data.gpa ?? null,
            did: studentDID,
            enrolledAt: new Date().toISOString()
        };

        // MongoDB is authoritative. Do not create a browser-only student when
        // Atlas is unavailable or the API rejects the request.
        if (!window.api?.studentEnroll) {
            throw new Error('MongoDB API is not available. Start the backend and sign in as the university.');
        }
        const backendResult = await window.api.studentEnroll(student);
        const persistedStudent = this.cacheStudent({
            ...backendResult.student,
            enrolledAt: student.enrolledAt
        });

        // Keep only a non-sensitive delivery receipt in the browser.
        const emailLog = this.dispatchEnrollmentEmail(persistedStudent);
        emailLog.deliveryStatus = backendResult.emailDelivered ? 'delivered' : 'not-delivered';
        emailLog.previewReason = backendResult.emailPreviewReason || backendResult.emailError || null;

        return {
            student: persistedStudent,
            emailLog,
            emailDelivered: backendResult.emailDelivered,
            emailPreview: backendResult.emailPreview,
            emailPreviewReason: backendResult.emailPreviewReason,
            emailError: backendResult.emailError
        };
    }

    /**
     * Student Authentication via Enrollment Number (Erno.) OR Email & Password
     */
    async login(identifier, password) {
        if (!identifier || !password) {
            throw new Error("Enrollment Number or Email and password are required.");
        }

        const cleanIdentifier = identifier.trim();

        if (!window.api?.studentLogin) {
            throw new Error('MongoDB API is not available. Start the backend before signing in.');
        }
        const backendResult = await window.api.studentLogin(cleanIdentifier, password);
        const activeStudent = backendResult.student;
        this.cacheStudent(activeStudent);

        // A credential issued from another browser/device is returned by the backend
        // after a successful student login. Store it in this wallet before rendering
        // the dashboard or holder portal.
        if (backendResult?.credentials?.length && window.credentialManager) {
            await window.credentialManager.importCredentials(backendResult.credentials);
        }

        // Establish Role-Based Authenticated Student Session
        localStorage.setItem('userRole', 'student');
        localStorage.setItem('authSession', 'true');
        localStorage.setItem('activeEnrollmentNo', activeStudent.enrollmentNo);
        localStorage.setItem('activeStudentEmail', activeStudent.email);
        localStorage.setItem('activeStudentName', activeStudent.name);
        localStorage.setItem('activeStudentProgram', activeStudent.program || 'Academic Program');
        localStorage.setItem('activeStudentDID', activeStudent.did || '');

        // Synchronize Active DID to Student's assigned DID
        if (window.didManager && activeStudent.did) {
            let existingDID = await window.didManager.getDID(activeStudent.did);
            if (!existingDID) {
                // Register into local did store if missing
                existingDID = {
                    id: activeStudent.did,
                    alias: activeStudent.name,
                    created: activeStudent.enrolledAt || new Date().toISOString()
                };
                if (window.storageManager) {
                    await window.storageManager.save('dids', existingDID);
                }
            }
            window.didManager.activeDID = existingDID;
        }

        return activeStudent;
    }

    /**
     * Change Password for Enrolled Student
     */
    async changePassword(currentPassword, newPassword) {
        const enrollmentNo = localStorage.getItem('activeEnrollmentNo');
        if (!enrollmentNo) throw new Error("No active student session found. Please sign in.");

        if (!currentPassword) throw new Error("Current password is required.");
        if (!newPassword || newPassword.length < 8) {
            throw new Error("New password must be at least 8 characters long.");
        }

        const student = this.getStudentByEnrollment(enrollmentNo) || window.api.getUserData();
        if (!student) throw new Error("Student record not found.");
        if (!window.api?.studentChangePassword) {
            throw new Error('MongoDB API is not available.');
        }
        await window.api.studentChangePassword(enrollmentNo, currentPassword, newPassword);

        // Log security confirmation email
        this.logEmail({
            to: student.email,
            subject: 'Security Notice: Your MIT-ADT Student Password Was Changed',
            body: `Hello ${student.name},\n\nYour password for Enrollment Number ${student.enrollmentNo} was successfully updated on ${new Date().toLocaleString()}.\n\nIf you did not authorize this change, please contact the Office of the Registrar immediately.`
        });

        return true;
    }

    /* ==========================================================================
       EMAIL DISPATCH & NOTIFICATION SYSTEM
       ========================================================================== */

    /**
     * Log and simulate email dispatch to student
     */
    logEmail(emailObj) {
        try {
            const newEmail = {
                id: 'email-' + Date.now(),
                ...emailObj,
                sentAt: new Date().toISOString()
            };
            this.emailLogs.unshift(newEmail);
            this.emailLogs = this.emailLogs.slice(0, 50);
            return newEmail;
        } catch (e) {
            return emailObj;
        }
    }

    getDispatchedEmails() {
        return [...this.emailLogs];
    }

    /**
     * Dispatches initial credentials email to student
     */
    dispatchEnrollmentEmail(student) {
        const email = {
            to: student.email,
            recipientName: student.name,
            subject: '🎓 MIT-ADT University: Your Student Digital Identity (DID) & Portal Credentials',
            type: 'ENROLLMENT',
            data: {
                studentName: student.name,
                enrollmentNo: student.enrollmentNo,
                email: student.email,
                program: student.program,
                did: student.did
            },
            body: `
Dear ${student.name},

Welcome to MIT Art, Design and Technology University, Pune.

Your official decentralized student identity has been provisioned by the Office of the Registrar. You can now access your Self-Sovereign Identity (SSI) wallet to receive, view, and share cryptographically verifiable degree certificates.

Login credentials have been securely dispatched to your registered email address.
For your security, credential values are not retained in this administrative portal.

Office of the Registrar
MIT Art, Design and Technology University, Pune
            `.trim()
        };

        return this.logEmail(email);
    }

    /**
     * Dispatches credential issuance notification to student
     */
    dispatchCredentialEmail(student, credential) {
        const degree = credential.credentialSubject?.degree || 'Academic Degree / Transcript';
        const cgpa = credential.credentialSubject?.gpa || 'N/A';
        const credId = credential.id || 'N/A';

        const email = {
            to: student.email,
            recipientName: student.name,
            subject: `📜 New Academic Credential Attested: ${degree}`,
            type: 'CREDENTIAL_ISSUED',
            data: {
                studentName: student.name,
                enrollmentNo: student.enrollmentNo,
                email: student.email,
                did: student.did || credential.credentialSubject?.id || '',
                degree: degree,
                cgpa: cgpa,
                credentialId: credId,
                issuanceDate: credential.issuanceDate
            },
            body: `
Dear ${student.name},

The Office of the Registrar at MIT Art, Design and Technology University has officially attested and issued a new cryptographic academic credential to your decentralized identity.

Credential Summary:
--------------------------------------------------
Degree / Attestation:  ${degree}
Cumulative GPA:        ${cgpa}
Enrollment Number:     ${student.enrollmentNo}
Credential ID:         ${credId}
Issuance Date:         ${new Date(credential.issuanceDate).toLocaleDateString()}
Assigned Student DID:  ${student.did || credential.credentialSubject?.id || 'Not available'}
--------------------------------------------------

This credential is permanently attested with cryptographic ECDSA signatures. Sign in to the Student Portal using your existing credentials to view your digital certificate and generate QR codes for employer verification.

Office of the Registrar
MIT Art, Design and Technology University, Pune
            `.trim()
        };

        // Asynchronously notify backend email service
        if (window.api && window.api.studentNotifyCredential) {
            window.api.studentNotifyCredential(student, credential).catch(err => {
                console.warn('Backend credential email notice:', err.message);
                window.app?.showError('Credential issued, but the student email was not delivered. Check the SMTP configuration.');
            });
        }

        return this.logEmail(email);
    }

    /**
     * Show an interactive simulated email modal in the browser
     */
    showEmailModal(emailObj) {
        let modal = document.getElementById('mit-email-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mit-email-modal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Mask password in preview body so admin cannot view student credentials
        const rawBody = emailObj.body || '';
        const sanitizedBody = rawBody
            .replace(/(Temporary (?:Login )?Password:\s*)([^\n]+)/gi, '$1●●●●●●●● [Dispatched to student email]')
            .replace(/(Portal Password:\s*)([^\n]+)/gi, '$1●●●●●●●● [Dispatched to student email]')
            .replace(/(Password:\s*)([^\n]+)/gi, '$1●●●●●●●● [Dispatched to student email]');

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 620px; border-top: 4px solid var(--brand-purple);">
                <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.5rem;">✉️</span>
                        <div>
                            <h3 style="margin:0; font-size:1.15rem;">Institutional Email ${emailObj.deliveryStatus === 'delivered' ? 'Delivery Confirmation' : 'Preview Notice'}</h3>
                            <small class="text-muted">MIT-ADT Registrar Attestation & Provisioning System</small>
                        </div>
                    </div>
                    <button class="btn-close" onclick="document.getElementById('mit-email-modal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body" style="padding:1.25rem 0;">
                    <div style="background:var(--bg-muted); padding:0.75rem 1rem; border-radius:8px; border:1px solid var(--border-subtle); margin-bottom:1rem; font-size:0.88rem;">
                        <p style="margin:2px 0;"><strong>${emailObj.deliveryStatus === 'delivered' ? 'Delivered To Student' : 'Intended Recipient'}:</strong> <code style="color:var(--brand-purple); font-weight:600;">${emailObj.to}</code></p>
                        <p style="margin:2px 0;"><strong>From:</strong> <code>registrar@mituniversity.edu.in</code> (Office of the Registrar)</p>
                        <p style="margin:2px 0;"><strong>Subject:</strong> ${emailObj.subject}</p>
                        <p style="margin:2px 0; font-size:0.78rem; color:var(--text-tertiary);"><strong>Dispatched:</strong> ${new Date(emailObj.sentAt || Date.now()).toLocaleString()}</p>
                    </div>

                    ${emailObj.deliveryStatus !== 'delivered' ? `
                        <div style="background:rgba(245, 158, 11, 0.12); border:1.5px solid rgba(245, 158, 11, 0.45); border-radius:8px; padding:1rem; margin-bottom:1rem; font-size:0.88rem;">
                            <strong>Email was not sent.</strong> This is an on-screen preview only. ${emailObj.previewReason || 'Configure SMTP to deliver student credentials.'}
                        </div>
                    ` : ''}

                    <!-- Role-Based Access Notice: Student credentials sent confidentially to student -->
                    <div style="background: rgba(99, 102, 241, 0.08); border: 1.5px solid rgba(99, 102, 241, 0.25); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:0.4rem;">
                            <span style="font-size:1.2rem;">🔒</span>
                            <h4 style="margin:0; color:var(--brand-purple); font-size:0.95rem;">${emailObj.deliveryStatus === 'delivered' ? 'Student Credentials Delivered Confidentially' : 'Student Credential Preview'}</h4>
                        </div>
                        <p style="margin:0 0 0.6rem 0; font-size:0.84rem; color:var(--text-secondary); line-height:1.4;">
                            Per institutional privacy and RBAC security policies, student login passwords are <strong>not visible to administrators</strong>. ${emailObj.deliveryStatus === 'delivered' ? `Credentials were delivered to the student's registered email address (<strong style="color:var(--text-primary);">${emailObj.to}</strong>).` : 'Configure SMTP and enroll again to deliver the generated login password.'}
                        </p>
                        <div style="display:grid; grid-template-columns: 140px 1fr; gap: 6px; font-size: 0.88rem; background:var(--bg-surface); padding:0.75rem; border-radius:6px; border:1px solid var(--border-subtle);">
                            <strong>Student Name:</strong> <span>${emailObj.data?.studentName || 'Student'}</span>
                            <strong>Enrollment No:</strong> <span class="badge badge-success" style="font-size:0.78rem; width:fit-content;">${emailObj.data?.enrollmentNo || 'N/A'}</span>
                            <strong>Assigned DID:</strong> <code style="font-size:0.76rem; word-break:break-all;">${emailObj.data?.did || 'N/A'}</code>
                            <strong>Portal Password:</strong> <span style="color:var(--accent-green); font-weight:600; font-size:0.82rem;">✓ Sent to ${emailObj.to} (Zero-Knowledge)</span>
                        </div>
                    </div>

                    <div style="background:var(--bg-muted); color:var(--text-primary); padding:1.25rem; border-radius:8px; border:1px solid var(--border-subtle); font-family:monospace; font-size:0.83rem; white-space:pre-wrap; max-height:240px; overflow-y:auto; line-height:1.5;">${sanitizedBody}</div>
                </div>
                <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:1rem;">
                    ${emailObj.data?.enrollmentNo ? `
                        <button type="button" class="btn btn-primary" onclick="if (window.credentialIssuerComponent) { window.credentialIssuerComponent.prefillCredentialForStudent('${emailObj.data.did || ''}', '${emailObj.data.studentName || ''}', '${emailObj.data.enrollmentNo}'); document.getElementById('mit-email-modal').classList.add('hidden'); }">
                            🎓 Proceed to Issue Degree for ${emailObj.data.enrollmentNo} →
                        </button>
                    ` : '<div></div>'}
                    <button class="btn btn-secondary" onclick="document.getElementById('mit-email-modal').classList.add('hidden')">
                        Close Notice
                    </button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    }
}

window.studentManager = new StudentManager();
