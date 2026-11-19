const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = null;
        this.previewMode = false;
        this.previewReason = null;
        // Keep the initialization promise so an early request cannot try to
        // send mail while SMTP authentication is still being checked.
        this.ready = this.initTransporter();
    }

    /**
     * Initialize Nodemailer transporter
     */
    async initTransporter() {
        try {
            let smtpUser = process.env.SMTP_USER;
            let smtpPass = process.env.SMTP_PASS;
            let smtpService = process.env.SMTP_SERVICE || 'gmail';
            const emailMode = (process.env.EMAIL_MODE || 'auto').trim().toLowerCase();

            if (emailMode === 'preview') {
                this.previewMode = true;
                this.previewReason = 'EMAIL_MODE=preview';
                console.log('Email preview mode enabled by EMAIL_MODE=preview');
                return;
            }

            // Gmail displays app passwords in groups of four characters. Removing
            // copied whitespace prevents a valid app password from being rejected.
            if (smtpPass) smtpPass = smtpPass.replace(/\s+/g, '');

            // Auto-detect if user put their email address in SMTP_SERVICE
            if (smtpService && smtpService.includes('@')) {
                smtpUser = smtpService;
                smtpService = 'gmail';
            }

            // 1. Direct Gmail Service (or any email with Gmail app password)
            if (smtpUser && smtpPass && (smtpService === 'gmail' || smtpUser.includes('@gmail.com'))) {
                // Gmail SMTP accepts a 16-character App Password, not a regular
                // account password or OAuth token. Stay in preview mode otherwise.
                if (smtpPass.length !== 16) {
                    this.previewMode = true;
                    this.previewReason = 'SMTP_PASS is not a 16-character Gmail App Password';
                    console.log('Email preview mode enabled: SMTP_PASS is not a 16-character Gmail App Password');
                    return;
                }
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 15000,
                    auth: {
                        user: smtpUser,
                        pass: smtpPass
                    }
                });
                await this.verifyTransport('Gmail', smtpUser);
            } 
            // 2. Custom SMTP Host configuration (SendGrid, Mailgun, AWS SES, Hostinger, etc.)
            else if (process.env.SMTP_HOST && smtpUser && smtpPass) {
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587'),
                    secure: process.env.SMTP_SECURE === 'true',
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 15000,
                    auth: {
                        user: smtpUser,
                        pass: smtpPass
                    }
                });
                await this.verifyTransport('Custom SMTP', process.env.SMTP_HOST);
            } else {
                // No fabricated SMTP account: preview means no external email
                // request is attempted and no login error is emitted.
                this.previewMode = true;
                this.previewReason = 'SMTP credentials are not configured';
                console.log('Email preview mode enabled: SMTP credentials are not configured');
            }
        } catch (error) {
            this.transporter = null;
            this.previewMode = true;
            this.previewReason = this.getSetupError(error);
            console.warn(`Email preview mode enabled: ${this.previewReason}`);
        }
    }

    /**
     * Authenticate before reporting that delivery is available. A 16-character
     * string alone is not proof that it is a valid Gmail App Password.
     */
    async verifyTransport(provider, account) {
        await this.transporter.verify();
        console.log(`✓ ${provider} email transport verified for ${account}`);
    }

    getSetupError(error) {
        const responseCode = error?.responseCode;
        if (responseCode === 535 || /badcredentials|invalid login/i.test(error?.message || '')) {
            return 'Gmail rejected SMTP login. Set SMTP_PASS to a newly generated 16-character Google App Password (not your normal Google password).';
        }
        return `SMTP verification failed: ${error?.message || 'unknown error'}`;
    }

    /**
     * Send Student Enrollment & Login Credentials Email
     */
    async sendStudentEnrollmentEmail(student, password) {
        const fromAddress = process.env.EMAIL_FROM || '"MIT-ADT University Registrar" <registrar@mituniversity.edu.in>';
        const subject = '🎓 MIT-ADT University: Your Student Digital Identity (DID) & Portal Credentials';

        const textContent = `
Dear ${student.name},

Welcome to MIT Art, Design and Technology University, Pune.

Your official decentralized student identity (DID) has been provisioned by the Office of the Registrar. You can now access your Self-Sovereign Identity (SSI) portal to view, manage, and share your accredited academic credentials.

Your Student Portal Login Credentials:
--------------------------------------------------
Enrollment Number (Erno.): ${student.enrollmentNo}
Registered Email ID:      ${student.email}
Temporary Login Password: ${password}
Assigned W3C DID:         ${student.did}
Login Gateway URL:        http://localhost:5500 (Select "Student Portal")
--------------------------------------------------

Security Notice:
You can log in using either your Enrollment Number or your Email ID with the password above. Please sign in and change your password in Settings at your earliest convenience.

Office of the Registrar
MIT Art, Design and Technology University, Pune
        `.trim();

        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #4f2d7f 0%, #1e1b4b 100%); color: #ffffff; padding: 24px; text-align: center;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 700;">MIT Art, Design and Technology University</h2>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Office of the Registrar • Division of Academic Attestations</p>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
                <h3 style="color: #1e293b; margin-top: 0;">Welcome, ${student.name}!</h3>
                <p>Your official decentralized student identity (DID) has been provisioned by the University Registrar. Below are your portal credentials to access your verified academic records.</p>
                
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                    <h4 style="margin: 0 0 12px 0; color: #4f2d7f; font-size: 15px;">Your Portal Login Credentials</h4>
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Enrollment No:</strong></td>
                            <td style="padding: 6px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${student.enrollmentNo}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b;"><strong>Registered Email:</strong></td>
                            <td style="padding: 6px 0; color: #0f172a;">${student.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b;"><strong>Login Password:</strong></td>
                            <td style="padding: 6px 0; font-family: monospace; font-weight: bold; color: #2563eb; font-size: 16px;">${password}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b;"><strong>Assigned DID:</strong></td>
                            <td style="padding: 6px 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #475569;">${student.did}</td>
                        </tr>
                    </table>
                </div>

                <div style="text-align: center; margin: 28px 0;">
                    <a href="http://localhost:5500" style="background: #4f2d7f; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Sign In to Student Portal →
                    </a>
                </div>

                <p style="font-size: 13px; color: #64748b;">
                    * You can sign in using either your <strong>Enrollment Number</strong> or <strong>Email ID</strong>. Once signed in, you can update your password in Settings.
                </p>
            </div>
            <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                MIT Art, Design and Technology University, Pune • Governed by MIT-ADT Act
            </div>
        </div>
        `;

        try {
            await this.ready;
            if (this.previewMode) {
                return { success: true, preview: true, previewReason: this.previewReason, to: student.email, subject, body: textContent };
            }
            const mailOptions = {
                from: fromAddress,
                to: student.email,
                subject: subject,
                text: textContent,
                html: htmlContent
            };

            if (this.transporter) {
                const info = await this.transporter.sendMail(mailOptions);
                console.log(`✓ Enrollment email sent to ${student.email}:`, info.messageId || 'Success');
            }

            return { success: true, to: student.email, subject, body: textContent };
        } catch (error) {
            console.warn('Failed to send email:', error.message);
            return { success: false, error: error.message, to: student.email, body: textContent };
        }
    }

    /**
     * Send Credential Attestation Email to Student
     */
    async sendCredentialAttestationEmail(student, credential) {
        const fromAddress = process.env.EMAIL_FROM || '"MIT-ADT University Registrar" <registrar@mituniversity.edu.in>';
        const degree = credential.credentialSubject?.degree || 'Academic Degree / Transcript';
        const cgpa = credential.credentialSubject?.gpa || 'N/A';
        const credId = credential.id || 'N/A';
        const studentDID = student.did || credential.credentialSubject?.id || 'Not available';
        const subject = `📜 Official Academic Degree Attested: ${degree}`;

        const textContent = `
Dear ${student.name},

The Office of the Registrar at MIT Art, Design and Technology University has officially attested and issued a new cryptographic academic credential to your decentralized identity.

Credential Summary:
--------------------------------------------------
Degree / Program:      ${degree}
Cumulative GPA:        ${cgpa} / 10
Enrollment Number:     ${student.enrollmentNo}
Credential Attestation ID: ${credId}
Issuance Date:         ${new Date(credential.issuanceDate || Date.now()).toLocaleDateString()}
Assigned Student DID:  ${studentDID}
--------------------------------------------------

Your credential has been signed with ECDSA cryptographic proofs and is now available in your Student Portal. You can view your digital certificate and generate QR codes for employer verification.

Log in to access your credential: http://localhost:5500

Office of the Registrar
MIT Art, Design and Technology University, Pune
        `.trim();

        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #059669 0%, #064e3b 100%); color: #ffffff; padding: 24px; text-align: center;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Academic Credential Attestation</h2>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #a7f3d0;">MIT Art, Design and Technology University, Pune</p>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
                <h3 style="color: #1e293b; margin-top: 0;">Congratulations, ${student.name}!</h3>
                <p>The University Registrar has attested and issued your official verifiable degree certificate to your Decentralized Identity.</p>
                
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                    <h4 style="margin: 0 0 12px 0; color: #059669; font-size: 15px;">Attested Credential Summary</h4>
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Degree Program:</strong></td>
                            <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${degree}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b;"><strong>Cumulative GPA:</strong></td>
                            <td style="padding: 6px 0; font-weight: bold; color: #d97706;">${cgpa} / 10</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b;"><strong>Enrollment No:</strong></td>
                            <td style="padding: 6px 0; font-family: monospace; color: #0f172a;">${student.enrollmentNo}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b;"><strong>Credential ID:</strong></td>
                            <td style="padding: 6px 0; font-family: monospace; font-size: 11px; color: #475569;">${credId}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b;"><strong>Assigned DID:</strong></td>
                            <td style="padding: 6px 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #475569;">${studentDID}</td>
                        </tr>
                    </table>
                </div>

                <div style="text-align: center; margin: 28px 0;">
                    <a href="http://localhost:5500" style="background: #059669; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Open Wallet & View Degree QR →
                    </a>
                </div>
            </div>
            <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                MIT Art, Design and Technology University, Pune
            </div>
        </div>
        `;

        try {
            await this.ready;
            if (this.previewMode) {
                return { success: true, preview: true, previewReason: this.previewReason, to: student.email, subject, body: textContent };
            }
            const mailOptions = {
                from: fromAddress,
                to: student.email,
                subject: subject,
                text: textContent,
                html: htmlContent
            };

            if (this.transporter) {
                await this.transporter.sendMail(mailOptions);
            }

            return { success: true, to: student.email, subject, body: textContent };
        } catch (error) {
            console.warn('Failed to send credential email:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();
