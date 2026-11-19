/**
 * CredentialManager
 * 
 * Manages Verifiable Credentials following W3C VC Data Model.
 * Handles issuance, storage, verification, and presentation of academic credentials.
 */
class CredentialManager {
    constructor() {
        this.credentials = [];
    }

    /**
     * Initialize an empty in-memory credential cache. MongoDB is the source of
     * truth; credentials are loaded after authentication.
     */
    async init() {
        this.credentials = [];
    }

    /**
     * Issue a new Verifiable Credential (Academic)
     * @param {Object} credentialData - The credential subject data
     * @param {string} credentialData.studentDID - DID of the student
     * @param {string} credentialData.studentName - Name of the student
     * @param {Array} credentialData.courses - Array of course objects
     * @param {string} credentialData.institution - Name of the institution
     * @param {string} credentialData.degree - Degree program
     * @param {Object} [options] - Optional issuance configuration (skipEthereumProof, autoRegisterStudentDID, batchMode)
     * @returns {Promise<Object>} The signed verifiable credential
     */
    async issueCredential(credentialData, options = {}) {
        // 1. Get issuer's DID and keys
        const issuerDID = window.didManager.activeDID?.id;
        if (!issuerDID) {
            throw new Error("No active DID for issuer");
        }

        // 2. Validate / auto-register student DID
        let studentDID = credentialData.studentDID;
        if (!studentDID || studentDID === 'auto') {
            // Creating a recipient DID must not switch away from the issuer key that
            // signs this credential.
            const newDid = await window.didManager.createDID(credentialData.studentName || 'Student Identity', { makeActive: false });
            studentDID = newDid.id;
            credentialData.studentDID = studentDID;
        }

        let studentRecord = await window.storageManager.get('dids', studentDID);
        if (!studentRecord) {
            if (options.autoRegisterStudentDID || options.batchMode) {
                studentRecord = {
                    id: studentDID,
                    alias: credentialData.studentName || 'Student Identity',
                    created: new Date().toISOString()
                };
                await window.storageManager.save('dids', studentRecord);
            } else {
                throw new Error(`Cannot issue credential: Student DID '${studentDID}' does not exist in the system. Please verify the DID is correct.`);
            }
        }

        // 3. Create credential ID
        const credentialId = `urn:uuid:${this.generateUUID()}`;

        // 4. Calculate GPA & courses
        let courses = credentialData.courses || [];
        let gpa = credentialData.gpa;
        if (gpa === undefined || gpa === null || gpa === '') {
            if (courses.length > 0) {
                try {
                    gpa = this.calculateGPA(courses);
                } catch (e) {
                    gpa = '8.50';
                }
            } else {
                gpa = '8.50';
            }
        } else {
            const numericGpa = Number(gpa);
            gpa = Number.isFinite(numericGpa) ? numericGpa.toFixed(2) : String(gpa);
        }

        // Build the credential following W3C VC Data Model
        const credential = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://www.w3.org/2018/credentials/examples/v1"
            ],
            "id": credentialId,
            "type": ["VerifiableCredential", "AcademicCredential"],
            "issuer": issuerDID,
            "issuanceDate": new Date().toISOString(),
            "credentialSubject": {
                "id": studentDID,
                "name": credentialData.studentName,
                "enrollmentNo": credentialData.enrollmentNo || credentialData.studentPRN || credentialData.prn || "",
                "prn": credentialData.studentPRN || credentialData.enrollmentNo || credentialData.prn || "",
                "email": credentialData.studentEmail || credentialData.email || "",
                "institution": credentialData.institution || "MIT Art, Design and Technology University, Pune",
                "degree": credentialData.degree,
                "courses": courses,
                "gpa": gpa,
                "gpaScale": 10
            }
        };

        // 5. Sign the credential with DID ECDSA key
        const privateKey = await window.didManager.getPrivateKey();
        const proof = await this.createProof(credential, privateKey, issuerDID);

        // 6. Sign with MetaMask if not skipped
        let ethereumProof = null;
        if (!options.skipEthereumProof) {
            if (window.web3Signer) {
                ethereumProof = await window.web3Signer.signCredential(credential);
            } else {
                throw new Error("Web3 signer is not available. Please ensure MetaMask and web3-signer are loaded.");
            }
        }

        // 7. Add proofs to credential
        const verifiableCredential = {
            ...credential,
            proof: proof
        };
        if (ethereumProof) {
            verifiableCredential.ethereumProof = ethereumProof;
        }

        // 8. Persist before showing the credential as issued. Never fall back
        // to browser storage for institutional academic records.
        if (!window.api?.saveCredential) {
            throw new Error('MongoDB API is not available. Start the backend before issuing credentials.');
        }
        await window.api.saveCredential(verifiableCredential);
        this.credentials.push(verifiableCredential);

        console.log('Credential issued:', credentialId, ethereumProof ? '(with ETH proof)' : '(DID ECDSA proof)');
        return verifiableCredential;
    }

    /**
     * Create a cryptographic proof for the credential
     * @param {Object} credential - The credential to sign
     * @param {CryptoKey} privateKey - Issuer's private key
     * @param {string} issuerDID - Issuer's DID
     * @returns {Promise<Object>} The proof object
     */
    async createProof(credential, privateKey, issuerDID) {
        // Create a canonical representation for signing (exclude all proof objects)
        const credentialCopy = { ...credential };
        delete credentialCopy.proof; // Remove DID proof if it exists
        delete credentialCopy.ethereumProof; // Remove Ethereum proof if it exists

        // Deterministic JSON prevents a valid signature from breaking merely
        // because MongoDB/API returned object keys in a different order.
        const canonicalData = window.cryptoUtils.canonicalJSONStringify(credentialCopy);

        // Sign the data
        const signature = await window.cryptoUtils.sign(canonicalData, privateKey);

        // Return proof object
        return {
            "type": "EcdsaSecp256r1Signature2019",
            "created": new Date().toISOString(),
            "verificationMethod": `${issuerDID}#owner`,
            "proofPurpose": "assertionMethod",
            "signature": signature
        };
    }

    /**
     * Verify a Verifiable Credential
     * @param {Object} credential - The credential to verify
     * @returns {Promise<Object>} Verification result with status and details
     */
    async verifyCredential(credential) {
        const result = {
            verified: false,
            checks: {
                structure: false,
                signature: false,
                ethereumSignature: false,
                expiration: true, // We don't have expiration in our simple model
                revocation: true  // We don't have revocation yet
            },
            issuer: null,
            ethereumSigner: null,
            network: null,
            isLegacy: false,
            errors: []
        };

        try {
            // 1. Check structure
            if (!credential.proof || !credential.credentialSubject || !credential.issuer) {
                result.errors.push("Invalid credential structure");
                return result;
            }
            result.checks.structure = true;
            result.issuer = credential.issuer;

            // 2. Resolve issuer DID to get public key
            const issuerDIDDoc = await window.didManager.resolve(credential.issuer);

            // Prefer the local authority registry when available, but do not require
            // it: the public key is encoded in this app's did:key identifier.
            let issuerRecord = await window.storageManager.get('dids', credential.issuer);
            if (!issuerRecord) {
                const dids = await window.storageManager.getAll('dids');
                issuerRecord = dids ? dids.find(d => d.alias === 'MIT-ADT Issuer') : null;
            }

            let publicKey;
            if (issuerRecord?.keys?.public) {
                publicKey = await window.cryptoUtils.importSigningKey(issuerRecord.keys.public, 'public');
            } else {
                publicKey = await window.cryptoUtils.importPublicKeyFromDID(credential.issuer);
            }

            // 3. Verify DID signature (excluding proof and ethereumProof)
            const credentialCopy = window.cryptoUtils.getCredentialSigningPayload(credential);
            // Try the deterministic format first. The two legacy variants keep
            // credentials issued by earlier versions valid after QR retrieval.
            const candidatePayloads = [
                window.cryptoUtils.canonicalJSONStringify(credentialCopy),
                JSON.stringify(credentialCopy),
                window.cryptoUtils.legacyCredentialJSONStringify(credential)
            ].filter((value, index, values) => values.indexOf(value) === index);
            let isValidDIDSignature = false;
            for (const canonicalData of candidatePayloads) {
                if (await window.cryptoUtils.verify(canonicalData, credential.proof.signature, publicKey)) {
                    isValidDIDSignature = true;
                    break;
                }
            }

            result.checks.signature = isValidDIDSignature;
            if (!isValidDIDSignature) {
                result.errors.push("DID signature verification failed");
            }

            // 4. Verify Ethereum EIP-712 Signature
            if (credential.ethereumProof) {
                if (window.web3Signer) {
                    const ethResult = window.web3Signer.verifyCredentialSignature(credential);
                    result.checks.ethereumSignature = ethResult.valid;
                    if (ethResult.valid) {
                        result.ethereumSigner = ethResult.signerAddress;
                        result.network = ethResult.network || 'sepolia';
                    } else {
                        result.errors.push(`Ethereum signature invalid: ${ethResult.error || 'Verification failed'}`);
                    }
                } else {
                    result.errors.push("Web3 signer module not loaded. Cannot verify Ethereum signature.");
                    result.checks.ethereumSignature = false;
                }
            } else {
                // Legacy credential without Ethereum proof (backward compatibility)
                result.checks.ethereumSignature = true;
                result.isLegacy = true;
                result.legacyNote = "No Ethereum signature (legacy credential)";
            }

            // 5. Overall verification
            result.verified = Object.values(result.checks).every(v => v === true);

            if (result.verified) {
                console.log('✓ Credential verified successfully');
            }

        } catch (error) {
            result.errors.push(error.message);
            console.error('Verification error:', error);
        }

        return result;
    }

    /**
     * Create a Verifiable Presentation (for sharing credentials)
     * @param {Array<string>} credentialIds - IDs of credentials to include
     * @param {string} holderDID - DID of the holder
     * @returns {Promise<Object>} The signed verifiable presentation
     */
    async createPresentation(credentialIds, holderDID = null) {
        if (!holderDID) {
            holderDID = window.didManager.activeDID?.id;
        }

        if (!holderDID) {
            throw new Error("No holder DID specified");
        }

        // Get the credentials
        const credentials = this.credentials.filter(c => credentialIds.includes(c.id));

        if (credentials.length === 0) {
            throw new Error("No credentials found with the specified IDs");
        }

        // Build presentation
        const presentation = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1"
            ],
            "type": ["VerifiablePresentation"],
            "id": `urn:uuid:${this.generateUUID()}`,
            "holder": holderDID,
            "verifiableCredential": credentials,
            "created": new Date().toISOString()
        };

        // Sign the presentation
        const privateKey = await window.didManager.getPrivateKey();
        const proof = await this.createProof(presentation, privateKey, holderDID);

        const verifiablePresentation = {
            ...presentation,
            proof: proof
        };

        console.log('Presentation created');
        return verifiablePresentation;
    }

    /**
     * Get all credentials for the current user
     */
    async getMyCredentials() {
        const myDID = window.didManager.activeDID?.id;
        const role = localStorage.getItem('userRole');
        const activeEnrollment = localStorage.getItem('activeEnrollmentNo');

        if (role === 'student') {
            // Strict Student RBAC: only return credentials attested specifically to this student
            const activeEmail = localStorage.getItem('activeStudentEmail');
            return this.credentials.filter(c => {
                const matchesDID = myDID && c.credentialSubject?.id === myDID;
                const matchesErno = activeEnrollment && (
                    c.credentialSubject?.enrollmentNo?.toUpperCase() === activeEnrollment.toUpperCase() ||
                    c.credentialSubject?.prn?.toUpperCase() === activeEnrollment.toUpperCase()
                );
                const matchesEmail = activeEmail && c.credentialSubject?.email && (
                    c.credentialSubject.email.toLowerCase() === activeEmail.toLowerCase()
                );
                return matchesDID || matchesErno || matchesEmail;
            });
        }

        if (!myDID) return [];

        return this.credentials.filter(
            c => c.credentialSubject.id === myDID || c.issuer === myDID
        );
    }

    /** Merge credentials received from MongoDB into the in-memory view cache. */
    async importCredentials(credentials) {
        if (!Array.isArray(credentials)) return;

        for (const credential of credentials) {
            if (!credential?.id) continue;
            const index = this.credentials.findIndex(item => item.id === credential.id);
            if (index >= 0) {
                this.credentials[index] = credential;
            } else {
                this.credentials.push(credential);
            }
        }
    }

    /**
     * Get a specific credential by ID
     */
    getCredential(id) {
        return this.credentials.find(c => c.id === id);
    }

    /** Remove a credential from the current browser view without affecting MongoDB. */
    removeFromCache(id) {
        this.credentials = this.credentials.filter(c => c.id !== id);
    }

    /**
     * Delete a credential
     */
    async deleteCredential(id) {
        if (!window.api?.deleteCredential) {
            throw new Error('MongoDB API is not available.');
        }
        await window.api.deleteCredential(id);
        this.credentials = this.credentials.filter(c => c.id !== id);
        console.log('Credential deleted:', id);
    }

    // --- Helper Functions ---

    // 10-point grading scale (edit as per the university's scheme)
    static GRADE_POINTS = {
        'O': 10, 'A+': 9, 'A': 8, 'B+': 7,
        'B': 6, 'C': 5, 'P': 4, 'F': 0
    };

    /**
     * Calculate CGPA (out of 10) = Σ(grade point × credits) / Σ(credits)
     */
    calculateGPA(courses) {
        if (!courses || courses.length === 0) return '0.00';

        let totalPoints = 0;
        let totalCredits = 0;

        for (const course of courses) {
            const name = course.courseName || course.name || 'course';
            const grade = String(course.grade || '').trim().toUpperCase();
            const credits = parseFloat(course.credits);

            if (!(grade in CredentialManager.GRADE_POINTS)) {
                throw new Error(`Invalid grade "${course.grade}" for ${name}. Use: O, A+, A, B+, B, C, P, F`);
            }
            if (!(credits > 0)) {
                throw new Error(`Invalid credits for ${name}`);
            }

            totalPoints += CredentialManager.GRADE_POINTS[grade] * credits;
            totalCredits += credits;
        }

        return (totalPoints / totalCredits).toFixed(2);
    }

    /**
     * Verify a Decentralized Identifier (DID)
     * @param {string} didString 
     * @returns {Promise<Object>}
     */
    async verifyDID(didString) {
        const result = {
            verified: false,
            did: didString,
            method: null,
            doc: null,
            isRegistered: false,
            alias: null,
            created: null,
            errors: []
        };

        try {
            if (!didString || typeof didString !== 'string') {
                throw new Error("Invalid DID input");
            }

            const cleanDID = didString.trim();
            if (!cleanDID.startsWith('did:')) {
                throw new Error("DID must start with 'did:' prefix (e.g. did:key:...)");
            }

            const parts = cleanDID.split(':');
            result.method = parts[1] || 'unknown';

            // Resolve DID Document
            const didDoc = await window.didManager.resolve(cleanDID);
            result.doc = didDoc;

            // Check if registered in local storage
            const record = await window.storageManager.get('dids', cleanDID);
            if (record) {
                result.isRegistered = true;
                result.alias = record.alias;
                result.created = record.created;
            }

            result.verified = true;
        } catch (err) {
            result.errors.push(err.message);
        }

        return result;
    }

    /**
     * Generate a UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Export singleton
window.credentialManager = new CredentialManager();
