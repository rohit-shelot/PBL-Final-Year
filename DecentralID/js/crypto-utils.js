/**
 * CryptoUtils
 * 
 * Provides cryptographic primitives using the Web Crypto API.
 * Handles key generation, signing, verification, hashing, and encryption.
 */
class CryptoUtils {
    constructor() {
        this.algo = {
            signing: {
                name: 'ECDSA',
                namedCurve: 'P-256'
            },
            encryption: {
                name: 'AES-GCM',
                length: 256
            },
            hashing: 'SHA-256'
        };
    }

    /**
     * Generates a new ECDSA key pair for signing (Identity Key)
     * @returns {Promise<CryptoKeyPair>} The generated key pair
     */
    async generateSigningKeyPair() {
        return await window.crypto.subtle.generateKey(
            this.algo.signing,
            true, // extractable for backup
            ['sign', 'verify']
        );
    }

    /**
     * Generates a simple did:key from a public key
     * Note: This is a simplified implementation. A full implementation would utilize
     * multicodec prefixes. We'll use a hex representation of the raw public key for simplicity
     * in this demo, or we can try to be slightly more standard compliant if possible.
     * 
     * @param {CryptoKey} publicKey 
     * @returns {Promise<string>} The DID string (did:key:...)
     */
    async publicKeyToDID(publicKey) {
        const exported = await window.crypto.subtle.exportKey('raw', publicKey);
        const buffer = new Uint8Array(exported);

        // For distinctness in this demo, we'll prefix with a custom 'demo' multicodec if we wanted,
        // but let's just hex encode the raw P-256 key.
        // A real did:key for P-256 starts with zDna... (multibase base58btc)
        // containing multicodec prefix for p256-pub (0x1200).

        // Let's us a simple hex encoding for this demo to avoid external dependencies like bs58
        const hex = this.bufferToHex(buffer);
        return `did:key:z${hex}`; // 'z' usually denotes base58, but we'll use it as a placeholder here or just 'did:key:hex:'
    }

    /**
     * exports a key to JWK format
     */
    async exportKey(key) {
        return await window.crypto.subtle.exportKey('jwk', key);
    }

    /**
     * Imports a key from JWK format
     */
    async importSigningKey(jwk, type = 'private') {
        return await window.crypto.subtle.importKey(
            'jwk',
            jwk,
            this.algo.signing,
            true,
            type === 'private' ? ['sign'] : ['verify']
        );
    }

    /**
     * Imports the P-256 public key embedded in this application's did:key value.
     * The project encodes the raw, uncompressed public key as hex after `did:key:z`.
     * This lets a verifier validate an issuer it has never seen before, rather than
     * depending on that issuer's IndexedDB record being present in the same browser.
     */
    async importPublicKeyFromDID(did) {
        const prefix = 'did:key:z';
        if (typeof did !== 'string' || !did.startsWith(prefix)) {
            throw new Error('Unsupported or malformed did:key identifier');
        }

        const hex = did.slice(prefix.length);
        if (!/^[0-9a-f]{130}$/i.test(hex)) {
            throw new Error('DID does not contain a valid P-256 public key');
        }

        const rawKey = this.hexToBuffer(hex);
        // A Web Crypto P-256 raw public key is an uncompressed EC point: 0x04 || X || Y.
        if (rawKey.length !== 65 || rawKey[0] !== 0x04) {
            throw new Error('DID contains an invalid P-256 public key');
        }

        return await window.crypto.subtle.importKey(
            'raw',
            rawKey,
            this.algo.signing,
            true,
            ['verify']
        );
    }

    /**
     * Signs data using a private key
     * @param {string|Object} data - Data to sign
     * @param {CryptoKey} privateKey 
     * @returns {Promise<string>} Hex encoded signature
     */
    async sign(data, privateKey) {
        const encoded = this.encodeData(data);
        const signature = await window.crypto.subtle.sign(
            {
                name: 'ECDSA',
                hash: { name: 'SHA-256' }
            },
            privateKey,
            encoded
        );
        return this.bufferToHex(new Uint8Array(signature));
    }

    /**
     * Verifies a signature
     * @param {string|Object} data 
     * @param {string} signatureHex 
     * @param {CryptoKey} publicKey 
     * @returns {Promise<boolean>}
     */
    async verify(data, signatureHex, publicKey) {
        const encoded = this.encodeData(data);
        const signature = this.hexToBuffer(signatureHex);
        return await window.crypto.subtle.verify(
            {
                name: 'ECDSA',
                hash: { name: 'SHA-256' }
            },
            publicKey,
            signature,
            encoded
        );
    }

    /**
     * Computes SHA-256 hash of data
     * @param {string|Object} data 
     * @returns {Promise<string>} Hex string of hash
     */
    async hash(data) {
        const encoded = this.encodeData(data);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
        return this.bufferToHex(new Uint8Array(hashBuffer));
    }

    /**
     * Generates a random salt
     */
    generateSalt(length = 16) {
        return window.crypto.getRandomValues(new Uint8Array(length));
    }

    /**
     * Derives an encryption key from a password/pin
     * @param {string} password 
     * @param {Uint8Array} salt 
     * @returns {Promise<CryptoKey>}
     */
    async deriveKeyFromPassword(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            this.algo.encryption,
            false, // Key itself not extractable
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Encrypts data with AES-GCM
     * @param {Object|string} data 
     * @param {CryptoKey} key 
     * @returns {Promise<{iv: string, ciphertext: string}>}
     */
    async encrypt(data, key) {
        const encoded = this.encodeData(data);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encoded
        );

        return {
            iv: this.bufferToHex(iv),
            ciphertext: this.bufferToHex(new Uint8Array(ciphertext))
        };
    }

    /**
     * Decrypts data with AES-GCM
     * @param {Object} encryptedPackage - {iv, ciphertext} in hex
     * @param {CryptoKey} key 
     * @returns {Promise<Object|string>} Decoded data
     */
    async decrypt(encryptedPackage, key) {
        const iv = this.hexToBuffer(encryptedPackage.iv);
        const ciphertext = this.hexToBuffer(encryptedPackage.ciphertext);

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertext
        );

        const dec = new TextDecoder();
        const decodedString = dec.decode(decrypted);
        try {
            return JSON.parse(decodedString);
        } catch (e) {
            return decodedString;
        }
    }

    // --- Helpers ---

    /**
     * Produce a deterministic JSON representation for data that is signed or
     * hashed. JSON.stringify preserves insertion order, which can change when
     * a credential is stored in and read back from MongoDB. Sorting object keys
     * makes the proof portable across the QR/API round trip.
     */
    canonicalJSONStringify(value) {
        const canonicalize = (item) => {
            if (Array.isArray(item)) return item.map(canonicalize);
            if (item && typeof item === 'object') {
                return Object.keys(item).sort().reduce((result, key) => {
                    result[key] = canonicalize(item[key]);
                    return result;
                }, {});
            }
            return item;
        };
        return JSON.stringify(canonicalize(value));
    }

    /** Return a credential payload without proof objects. */
    getCredentialSigningPayload(credential) {
        const payload = { ...credential };
        delete payload.proof;
        delete payload.ethereumProof;
        return payload;
    }

    /**
     * Rebuild the property order used by credentials issued before canonical
     * serialization was introduced. This keeps already-issued QR credentials
     * verifiable after a database read changes their top-level field order.
     */
    legacyCredentialJSONStringify(credential) {
        const payload = this.getCredentialSigningPayload(credential);
        const subject = payload.credentialSubject;
        if (!subject || typeof subject !== 'object') return JSON.stringify(payload);

        // The course rows were also built in a fixed order by every issuer UI.
        // MongoDB can return embedded-document keys in a different order, so
        // restore that order before validating credentials issued by old builds.
        const orderedCourses = Array.isArray(subject.courses)
            ? subject.courses.map((course) => {
                if (!course || typeof course !== 'object' || Array.isArray(course)) return course;
                const orderedCourse = {};
                for (const key of ['courseName', 'grade', 'credits', 'year']) {
                    if (Object.prototype.hasOwnProperty.call(course, key)) orderedCourse[key] = course[key];
                }
                for (const key of Object.keys(course)) {
                    if (!Object.prototype.hasOwnProperty.call(orderedCourse, key)) orderedCourse[key] = course[key];
                }
                return orderedCourse;
            })
            : subject.courses;

        const orderedSubjectKeys = ['id', 'name', 'enrollmentNo', 'prn', 'email', 'institution', 'degree', 'courses', 'gpa', 'gpaScale'];
        const orderedSubject = {};
        for (const key of orderedSubjectKeys) {
            if (Object.prototype.hasOwnProperty.call(subject, key)) {
                orderedSubject[key] = key === 'courses' ? orderedCourses : subject[key];
            }
        }
        for (const key of Object.keys(subject)) {
            if (!Object.prototype.hasOwnProperty.call(orderedSubject, key)) orderedSubject[key] = subject[key];
        }

        const orderedPayload = {};
        for (const key of ['@context', 'id', 'type', 'issuer', 'issuanceDate']) {
            if (Object.prototype.hasOwnProperty.call(payload, key)) orderedPayload[key] = payload[key];
        }
        orderedPayload.credentialSubject = orderedSubject;
        for (const key of Object.keys(payload)) {
            if (key !== 'credentialSubject' && !Object.prototype.hasOwnProperty.call(orderedPayload, key)) {
                orderedPayload[key] = payload[key];
            }
        }
        return JSON.stringify(orderedPayload);
    }

    encodeData(data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        return new TextEncoder().encode(str);
    }

    bufferToHex(buffer) {
        return Array.from(buffer)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    hexToBuffer(hex) {
        const pairs = hex.match(/[\da-f]{2}/gi);
        if (!pairs) return new Uint8Array();
        return new Uint8Array(pairs.map(h => parseInt(h, 16)));
    }
}

// Export singleton
window.cryptoUtils = new CryptoUtils();
