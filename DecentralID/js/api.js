/**
 * API Configuration and Helper Functions
 * Centralized API calls for authentication
 */

// Detect environment and set appropriate API URL
const getApiBaseUrl = () => {
    // Check if running on GitHub Pages
    if (window.location.hostname === 'kash-gg.github.io') {
        // Production: Use deployed backend on Render
        // TODO: Replace this URL with your actual Render URL after deployment
        return 'https://project-ssi-backend.onrender.com/api';
    }
    // Local development
    return 'http://localhost:3000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Atlas round-trips on this network are often around 1.5s before bcrypt work.
// A shorter abort makes a live backend look offline.
const API_TIMEOUT_MS = 12000;

/**
 * Fetch wrapper with configurable abort timeout to prevent UI freezes
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = API_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Backend server did not respond in time. MongoDB-backed operations require the backend to be online.');
        }
        throw err;
    }
};

const api = {
    /**
     * University Login
     */
    async universityLogin(email, password) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/university/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            }, API_TIMEOUT_MS);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            localStorage.setItem('authSession', 'true');
            localStorage.setItem('userRole', 'university');
            localStorage.setItem('userData', JSON.stringify(data.user));

            return data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Verifier Login
     */
    async verifierLogin(orgId, password) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/verifier/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ orgId, password })
            }, API_TIMEOUT_MS);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            localStorage.setItem('authSession', 'true');
            localStorage.setItem('userRole', 'verifier');
            localStorage.setItem('userData', JSON.stringify(data.user));

            return data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Student Enrollment (by University Admin)
     */
    async studentEnroll(studentData) {
        const token = this.getToken();
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/enroll`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(studentData)
            // MongoDB persistence plus SMTP verification/delivery can take a few
            // seconds. Do not abort a valid enrollment at the old 2.5s limit.
            }, 20000);

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Enrollment failed');
            }
            return data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Student Login by Enrollment Number (Erno.) OR Email & Password
     */
    async studentLogin(identifier, password) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifier, password })
            }, API_TIMEOUT_MS);

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Student login failed');
            }

            localStorage.setItem('authSession', 'true');
            localStorage.setItem('userRole', 'student');
            localStorage.setItem('userData', JSON.stringify(data.student));

            return data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Notify Student of Issued Academic Credential via Backend Email Service
     */
    async studentNotifyCredential(student, credential) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/notify-credential`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ student, credential })
            }, 20000);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Credential email could not be delivered');
            }
            return data;
        } catch (error) {
            console.warn('Backend credential email notice:', error.message);
            return { success: false, error: error.message };
        }
    },

    /** Store an issued VC so its recipient can retrieve it after signing in elsewhere. */
    async saveCredential(credential) {
        const token = this.getToken();
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ credential })
        }, API_TIMEOUT_MS);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Credential sync failed');
        return data;
    },

    /** Retrieve a full credential after its compact, holder-shared QR is scanned. */
    async getPublicCredential(credentialId) {
        const response = await fetchWithTimeout(
            `${API_BASE_URL}/auth/public/credentials/${encodeURIComponent(credentialId)}`,
            { method: 'GET' },
            5000
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Credential could not be retrieved');
        return data.credential;
    },

    /** Store a selective presentation and return a compact QR-resolvable reference. */
    async saveSelectivePresentation(presentation) {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/presentations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presentation })
        }, 5000);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Selective presentation could not be saved');
        return data;
    },

    /** Retrieve a selective presentation after scanning its compact QR. */
    async getPublicSelectivePresentation(presentationId) {
        const response = await fetchWithTimeout(
            `${API_BASE_URL}/auth/public/presentations/${encodeURIComponent(presentationId)}`,
            { method: 'GET' },
            5000
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Selective presentation could not be retrieved');
        return data.presentation;
    },

    /**
     * Student Changes Password
     */
    async studentChangePassword(enrollmentNo, currentPassword, newPassword) {
        const token = this.getToken();
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ enrollmentNo, currentPassword, newPassword })
            }, API_TIMEOUT_MS);

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update password');
            }
            return data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get All Enrolled Students
     */
    async getEnrolledStudents() {
        const token = this.getToken();
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/students`, {
            method: 'GET',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }, API_TIMEOUT_MS);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to retrieve students');
        return data.students || [];
    },

    /** Update a MongoDB student profile without changing its password. */
    async updateStudent(enrollmentNo, studentData) {
        const token = this.getToken();
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/students/${encodeURIComponent(enrollmentNo)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(studentData)
        }, API_TIMEOUT_MS);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update student');
        return data.student;
    },

    /** Remove a student account from the university directory. */
    async deleteStudent(enrollmentNo) {
        const token = this.getToken();
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/students/${encodeURIComponent(enrollmentNo)}`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }, API_TIMEOUT_MS);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete student');
        return data;
    },

    /** Remove every student account from the university directory. */
    async deleteAllStudents() {
        const token = this.getToken();
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/students`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }, 5000);
        const data = await response.json();
        if (!response.ok) {
            const error = new Error(data.error || 'Failed to delete students');
            error.status = response.status;
            throw error;
        }
        return data;
    },

    /** Deliver a new temporary password after a previous email delivery failed. */
    async resendStudentCredentials(enrollmentNo) {
        const token = this.getToken();
        const response = await fetchWithTimeout(
            `${API_BASE_URL}/auth/students/${encodeURIComponent(enrollmentNo)}/resend-credentials`,
            {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            },
            20000
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Credentials could not be emailed');
        return data;
    },

    /** Load credentials persisted for the authenticated university issuer. */
    async getIssuedCredentials(issuerDID) {
        const token = this.getToken();
        const query = issuerDID ? `?issuer=${encodeURIComponent(issuerDID)}` : '';
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/credentials${query}`, {
            method: 'GET',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }, API_TIMEOUT_MS);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to retrieve credentials');
        return data.credentials || [];
    },

    async deleteCredential(id) {
        const token = this.getToken();
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/student/credentials/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }, API_TIMEOUT_MS);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete credential');
        return data;
    },

    /**
     * University Registration
     */
    async universityRegister(email, password, universityName) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/university/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, universityName })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            return data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Verifier Registration
     */
    async verifierRegister(orgId, password, organizationName) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/auth/verifier/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ orgId, password, organizationName })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            return data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get authentication token
     */
    getToken() {
        return null;
    },

    /**
     * Get user data
     */
    getUserData() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    },

    /**
     * Logout - clear stored authentication data
     */
    logout() {
        fetchWithTimeout(`${API_BASE_URL}/auth/logout`, { method: 'POST' }).catch(() => {});
        localStorage.removeItem('authSession');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userData');
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return localStorage.getItem('authSession') === 'true';
    },

    /**
     * Make authenticated API call
     */
    async authenticatedRequest(url, options = {}) {
        const token = this.getToken();

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers
        });

        if (response.status === 401 || response.status === 403) {
            // Token expired or invalid
            this.logout();
            throw new Error('Session expired. Please login again.');
        }

        return response;
    }
};

// Make api object available globally
window.api = api;
