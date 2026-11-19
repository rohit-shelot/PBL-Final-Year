const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, generateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { withTransaction } = require('../config/database');

function publicStudent(student) {
    return {
        enrollmentNo: student.enrollmentNo,
        email: student.email,
        name: student.name,
        program: student.program,
        graduationYear: student.graduationYear,
        institution: student.institution,
        courses: student.courses || [],
        gpa: student.gpa ?? null,
        did: student.did,
        role: 'student'
    };
}

function didOwnerForRequest(user, body = {}) {
    if (user.role === 'student') {
        return {
            role: 'student',
            email: user.email,
            enrollmentNo: user.enrollmentNo
        };
    }
    return {
        role: 'university',
        email: user.email,
        enrollmentNo: body.enrollmentNo || null
    };
}

function setSessionCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('decentralid_session', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
    });
}

// Validation middleware
const validateUniversityLogin = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

const validateVerifierLogin = [
    body('orgId').notEmpty().withMessage('Organization ID is required'),
    body('password').notEmpty().withMessage('Password is required')
];

const validateUniversityRegister = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('universityName').notEmpty().withMessage('University name is required')
];

const validateVerifierRegister = [
    body('orgId').notEmpty().withMessage('Organization ID is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('organizationName').notEmpty().withMessage('Organization name is required')
];

// University Login
router.post('/university/login', validateUniversityLogin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // Credentials are always verified against the bcrypt hash in MongoDB.
        // Environment values are used only by the explicit seed command.
        const university = await User.findUniversityByEmail(normalizedEmail);
        if (!university) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isValidPassword = await User.verifyPassword(password, university.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = generateToken({
            id: university._id,
            email: university.email,
            role: 'university',
            universityName: university.universityName
        });

        setSessionCookie(res, token);

        res.json({
            success: true,
            message: 'Authentication successful',
            user: {
                email: university.email,
                universityName: university.universityName,
                role: 'university'
            }
        });
    } catch (error) {
        console.error('University login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Verifier Login
router.post('/verifier/login', validateVerifierLogin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { orgId, password } = req.body;
        const normalizedOrgId = orgId.trim();

        // Verifier passwords are only stored and compared as bcrypt hashes.
        const verifier = await User.findVerifierByOrgId(normalizedOrgId);
        if (!verifier) {
            return res.status(401).json({ error: 'Invalid organization ID or password' });
        }

        const isValidPassword = await User.verifyPassword(password, verifier.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid organization ID or password' });
        }

        const token = generateToken({
            id: verifier._id,
            orgId: verifier.orgId,
            role: 'verifier',
            organizationName: verifier.organizationName
        });

        setSessionCookie(res, token);

        res.json({
            success: true,
            message: 'Verifier login successful',
            user: {
                orgId: verifier.orgId,
                organizationName: verifier.organizationName,
                role: 'verifier'
            }
        });
    } catch (error) {
        console.error('Verifier login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// University Registration
router.post('/university/register', authenticateToken, validateUniversityRegister, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university administrator can create university accounts' });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, universityName } = req.body;

        // Check if university already exists
        const existingUniversity = await User.findUniversityByEmail(email);
        if (existingUniversity) {
            return res.status(400).json({ error: 'University with this email already exists' });
        }

        // Create new university
        await User.createUniversity(email, password, universityName);

        res.status(201).json({
            success: true,
            message: 'University registered successfully'
        });
    } catch (error) {
        console.error('University registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Verifier Registration
router.post('/verifier/register', authenticateToken, validateVerifierRegister, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university administrator can create verifier accounts' });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { orgId, password, organizationName } = req.body;

        // Check if verifier already exists
        const existingVerifier = await User.findVerifierByOrgId(orgId);
        if (existingVerifier) {
            return res.status(400).json({ error: 'Organization with this ID already exists' });
        }

        // Create new verifier
        await User.createVerifier(orgId, password, organizationName);

        res.status(201).json({
            success: true,
            message: 'Verifier registered successfully'
        });
    } catch (error) {
        console.error('Verifier registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

/* ==========================================================================
   STUDENT ENROLLMENT, AUTHENTICATION & PASSWORD MANAGEMENT
   ========================================================================== */

/**
 * University Registrar Enrolls a Student with Generated DID
 * Endpoint: POST /api/auth/student/enroll
 */
router.post('/student/enroll', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can enroll students' });
        }
        const { enrollmentNo, email, name, program, graduationYear, institution, courses, gpa, did } = req.body;

        if (!enrollmentNo || !email || !name) {
            return res.status(400).json({ error: 'Enrollment number, email, and name are required.' });
        }

        // Generate a cryptographically strong one-time password on the server.
        // It is never returned in an API response or shown in the web UI.
        const tempPassword = crypto.randomBytes(18).toString('base64url');
        const cleanEnrollment = enrollmentNo.trim().toUpperCase();
        const cleanEmail = email.trim().toLowerCase();
        const didRecord = req.body.didRecord;

        await withTransaction(async (session) => {
            if (didRecord) {
                await User.saveDid(didRecord, {
                    role: 'student',
                    email: cleanEmail,
                    enrollmentNo: cleanEnrollment
                }, session);
            } else if (did) {
                await User.assignDidOwner(did, {
                    role: 'student',
                    email: cleanEmail,
                    enrollmentNo: cleanEnrollment
                }, session);
            }

            await User.enrollStudent({
                enrollmentNo,
                email,
                name,
                program,
                graduationYear,
                institution,
                courses,
                gpa,
                did: didRecord?.id || did,
                password: tempPassword
            }, session);
        });

        const studentData = {
            enrollmentNo: enrollmentNo.trim().toUpperCase(),
            email: email.trim().toLowerCase(),
            name: name.trim(),
            program: program || 'B.Tech Computer Science & Engineering',
            graduationYear: graduationYear || 2027,
            institution: institution || 'MIT Art, Design and Technology University, Pune',
            courses: Array.isArray(courses) ? courses : [],
            gpa: gpa ?? null,
            did: did || null,
            role: 'student'
        };

        // Email delivery is separate from database persistence. The account has
        // already been committed to Atlas before attempting SMTP.
        const emailResult = await emailService.sendStudentEnrollmentEmail(studentData, tempPassword);

        res.status(201).json({
            success: true,
            message: emailResult.preview
                ? `Student ${name} was stored in MongoDB. Email preview mode is active.`
                : emailResult.success
                ? `Student ${name} enrolled successfully. Login credentials dispatched to ${email}.`
                : `Student ${name} was stored in MongoDB, but the login email could not be delivered.`,
            student: studentData,
            emailDelivered: emailResult.success && !emailResult.preview,
            emailPreview: Boolean(emailResult.preview),
            emailPreviewReason: emailResult.preview ? emailResult.previewReason : undefined,
            emailError: emailResult.success ? undefined : emailResult.error
        });

    } catch (error) {
        console.error('Student enrollment error:', error);
        res.status(500).json({ error: 'Server error during student enrollment' });
    }
});

/**
 * Student Login via Enrollment Number (Erno.) OR Email ID & Password
 * Endpoint: POST /api/auth/student/login
 */
router.post('/student/login', async (req, res) => {
    try {
        const identifier = req.body.identifier || req.body.enrollmentNo || req.body.email;
        const password = req.body.password;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Enrollment number or email and password are required.' });
        }

        const cleanIdentifier = identifier.trim();

        const student = await User.findStudentByEnrollmentOrEmail(cleanIdentifier);

        if (!student) {
            return res.status(401).json({ error: 'Invalid enrollment number, email, or password' });
        }

        const isMatch = await User.verifyPassword(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid enrollment number, email, or password' });
        }

        const token = generateToken({
            id: student._id,
            enrollmentNo: student.enrollmentNo,
            email: student.email,
            name: student.name,
            did: student.did,
            role: 'student'
        });

        setSessionCookie(res, token);

        const credentials = await User.listCredentialsForStudent(student);
        const signingDid = student.did ? await User.findDidById(student.did) : null;

        res.json({
            success: true,
            message: 'Student authenticated successfully',
            student: publicStudent(student),
            signingDid,
            credentials
        });

    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ error: 'Server error during student login' });
    }
});

/** Restore the signed-in account from the session cookie. Profiles come from MongoDB. */
router.get('/session', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'student') {
            const student = await User.findStudentByEnrollmentNo(req.user.enrollmentNo);
            if (!student) return res.status(401).json({ error: 'Student session is no longer valid' });
            const signingDid = student.did ? await User.findDidById(student.did) : null;
            const credentials = await User.listCredentialsForStudent(student);
            return res.json({
                success: true,
                role: 'student',
                profile: publicStudent(student),
                signingDid,
                credentials
            });
        }

        if (req.user.role === 'university') {
            const university = await User.findUniversityByEmail(req.user.email);
            if (!university) return res.status(401).json({ error: 'University session is no longer valid' });
            const signingDid = await User.findIssuerDid(university.email);
            return res.json({
                success: true,
                role: 'university',
                profile: {
                    email: university.email,
                    universityName: university.universityName,
                    role: 'university'
                },
                signingDid
            });
        }

        if (req.user.role === 'verifier') {
            const verifier = await User.findVerifierByOrgId(req.user.orgId);
            if (!verifier) return res.status(401).json({ error: 'Verifier session is no longer valid' });
            return res.json({
                success: true,
                role: 'verifier',
                profile: {
                    orgId: verifier.orgId,
                    organizationName: verifier.organizationName,
                    role: 'verifier'
                }
            });
        }

        return res.status(403).json({ error: 'Unknown session role' });
    } catch (error) {
        console.error('Session restore error:', error);
        res.status(500).json({ error: 'Could not restore the session' });
    }
});

router.post('/dids', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university' && req.user.role !== 'student') {
            return res.status(403).json({ error: 'Only a university or student session can store a DID' });
        }

        const saved = await withTransaction(async (session) => {
            return await User.saveDid(req.body.did, didOwnerForRequest(req.user, req.body), session);
        });
        res.status(201).json({ success: true, did: User.toPublicDid(saved) });
    } catch (error) {
        console.error('DID storage error:', error);
        res.status(400).json({ error: error.message || 'Failed to store DID' });
    }
});

router.get('/dids/:id', authenticateToken, async (req, res) => {
    try {
        const did = await User.findDidById(req.params.id);
        if (!did) return res.status(404).json({ error: 'DID not found' });
        const visible = User.callerOwnsDid(req.user, did) ? did : User.toPublicDid(did);
        res.json({ success: true, did: visible });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve DID' });
    }
});

router.delete('/dids/:id', authenticateToken, async (req, res) => {
    try {
        const did = await User.findDidById(req.params.id);
        if (!did) return res.status(404).json({ error: 'DID not found' });
        if (!User.callerOwnsDid(req.user, did)) {
            return res.status(403).json({ error: 'You can only delete a DID owned by this session' });
        }
        await withTransaction(async (session) => {
            await User.deleteOwnedDid(did.id, session);
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete DID' });
    }
});

router.post('/logout', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('decentralid_session', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    });
    res.json({ success: true });
});

/**
 * Notify Student of Issued Academic Credential via Email
 * Endpoint: POST /api/auth/student/notify-credential
 */
router.post('/student/notify-credential', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can send credential notifications' });
        }
        const { student, credential } = req.body;
        if (!student || !student.email || !credential) {
            return res.status(400).json({ error: 'Student email and credential data are required.' });
        }

        const result = await emailService.sendCredentialAttestationEmail(student, credential);
        if (!result.success) {
            return res.status(502).json({ error: result.error || 'Credential email could not be delivered' });
        }
        res.json({
            success: true,
            message: result.preview
                ? 'Credential was issued. Email preview mode is active.'
                : 'Attestation email dispatched successfully',
            result
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send attestation email: ' + error.message });
    }
});

/** Resolve a credential explicitly shared through its compact verification QR. */
router.get('/public/credentials/:id', async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id || id.length > 200) {
            return res.status(400).json({ error: 'A valid credential id is required' });
        }

        const credential = await User.findPublicCredentialById(id);
        if (!credential) {
            return res.status(404).json({ error: 'Credential not found or no longer available' });
        }
        res.json({ success: true, credential });
    } catch (error) {
        console.error('Public credential lookup error:', error);
        res.status(500).json({ error: 'Could not retrieve the shared credential' });
    }
});

/** Resolve a selective presentation deliberately shared through its compact QR. */
router.get('/public/presentations/:id', async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id || id.length > 200) return res.status(400).json({ error: 'A valid presentation id is required' });
        const presentation = await User.findPublicSelectivePresentationById(id);
        if (!presentation) return res.status(404).json({ error: 'Selective presentation not found or no longer available' });
        res.json({ success: true, presentation });
    } catch (error) {
        console.error('Public selective presentation lookup error:', error);
        res.status(500).json({ error: 'Could not retrieve the selective presentation' });
    }
});

/** Store a holder-created presentation so its QR can remain compact and scannable. */
router.post('/student/presentations', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: 'Only the credential holder can share a selective presentation' });
        }
        await withTransaction(async (session) => {
            await User.saveSelectivePresentation(req.body.presentation, req.user.did, session);
        });
        res.status(201).json({ success: true, message: 'Selective presentation is ready to share' });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Failed to store the selective presentation' });
    }
});

/** Store an issued VC for the student who is its cryptographic subject. */
router.post('/student/credentials', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can store credentials' });
        }
        await withTransaction(async (session) => {
            await User.saveCredential(req.body.credential, session);
        });
        res.status(201).json({ success: true, message: 'Credential saved for recipient' });
    } catch (error) {
        console.error('Credential storage error:', error);
        res.status(500).json({ error: 'Failed to save credential: ' + error.message });
    }
});

/** List persisted credentials for the current university issuer. */
router.get('/student/credentials', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can list credentials' });
        }
        const credentials = await User.listCredentialsForIssuer(req.query.issuer);
        res.json({ success: true, credentials });
    } catch (error) {
        console.error('Credential listing error:', error);
        res.status(500).json({ error: 'Failed to retrieve credentials: ' + error.message });
    }
});

router.delete('/student/credentials/:id', authenticateToken, async (req, res) => {
    return res.status(403).json({ error: 'Action disallowed: Issued academic certificates are permanent verifiable records and cannot be deleted once issued.' });
});

/**
 * Student Changes Their Password
 * Endpoint: POST /api/auth/student/change-password
 */
router.post('/student/change-password', authenticateToken, async (req, res) => {
    try {
        const { enrollmentNo, currentPassword, newPassword } = req.body;

        if (!enrollmentNo || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Enrollment number, current password, and new password are required.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
        }

        const cleanEnrollment = enrollmentNo.trim().toUpperCase();
        if (req.user.role !== 'student' || req.user.enrollmentNo !== cleanEnrollment) {
            return res.status(403).json({ error: 'You can only change your own password' });
        }

        const student = await User.findStudentByEnrollmentNo(cleanEnrollment);

        if (!student) {
            return res.status(404).json({ error: 'Student record not found' });
        }
        const isMatch = await User.verifyPassword(currentPassword, student.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect.' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await withTransaction(async (session) => {
            await User.setStudentPasswordHash(cleanEnrollment, hashedPassword, session);
        });

        res.json({
            success: true,
            message: 'Password updated successfully. You can now use your new password.'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error updating password' });
    }
});

/**
 * List all Enrolled Students (for University Registrar)
 * Endpoint: GET /api/auth/students
 */
router.get('/students', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can list students' });
        }
        const students = await User.listStudents();
        res.json({ success: true, students });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve students: ' + error.message });
    }
});

/** Permanently remove every student account from the registrar directory. */
router.delete('/students', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can delete students' });
        }

        const result = await withTransaction(async (session) => {
            return await User.deleteAllStudents(session);
        });
        res.json({
            success: true,
            deletedCount: result.deletedCount,
            message: `${result.deletedCount} student account${result.deletedCount === 1 ? '' : 's'} deleted.`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete students: ' + error.message });
    }
});

/**
 * Generate and deliver a replacement temporary password. The password is only
 * saved after SMTP confirms delivery, so a failed mail setup never locks a
 * student out of their existing account.
 */
router.post('/students/:enrollmentNo/resend-credentials', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can resend credentials' });
        }

        const enrollmentNo = String(req.params.enrollmentNo || '').trim().toUpperCase();
        const student = await User.findStudentByEnrollmentNo(enrollmentNo);
        if (!student) return res.status(404).json({ error: 'Student record not found' });

        const temporaryPassword = crypto.randomBytes(18).toString('base64url');
        const studentData = {
            enrollmentNo: student.enrollmentNo,
            email: student.email,
            name: student.name,
            program: student.program,
            graduationYear: student.graduationYear,
            did: student.did
        };
        const emailResult = await emailService.sendStudentEnrollmentEmail(studentData, temporaryPassword);

        if (!emailResult.success || emailResult.preview) {
            return res.status(503).json({
                error: emailResult.previewReason || emailResult.error || 'Email delivery is not configured',
                emailPreview: Boolean(emailResult.preview)
            });
        }

        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        await withTransaction(async (session) => {
            await User.setStudentPasswordHash(enrollmentNo, hashedPassword, session);
        });
        res.json({ success: true, message: `New login credentials delivered to ${student.email}` });
    } catch (error) {
        console.error('Credential resend error:', error);
        res.status(500).json({ error: 'Could not resend student credentials' });
    }
});

router.put('/students/:enrollmentNo', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can update students' });
        }
        const student = await User.updateStudentProfile(req.params.enrollmentNo, req.body);
        if (!student) return res.status(404).json({ error: 'Student record not found' });
        const { password, ...safeStudent } = student;
        res.json({ success: true, student: safeStudent });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update student: ' + error.message });
    }
});

/** Delete a student account from the registrar directory. */
router.delete('/students/:enrollmentNo', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'university') {
            return res.status(403).json({ error: 'Only an authorized university issuer can delete students' });
        }

        const enrollmentNo = String(req.params.enrollmentNo || '').trim().toUpperCase();
        const student = await User.findStudentByEnrollmentNo(enrollmentNo);
        if (!student) {
            return res.status(404).json({ error: 'Student record not found' });
        }

        const result = await withTransaction(async (session) => {
            const issuedCredentials = await User.listCredentialsForStudent(student);
            if (issuedCredentials && issuedCredentials.length > 0) {
                const error = new Error(`Cannot delete student ${enrollmentNo}: An official academic certificate has already been issued for this student. Once a certificate is issued, it becomes a permanent record and cannot be deleted.`);
                error.statusCode = 403;
                throw error;
            }
            return await User.deleteStudent(enrollmentNo, session);
        });
        if (!result.deletedCount) {
            return res.status(404).json({ error: 'Student record not found' });
        }

        res.json({ success: true, message: `Student ${enrollmentNo} was deleted.` });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Failed to delete student: ' + error.message
        });
    }
});

module.exports = router;
