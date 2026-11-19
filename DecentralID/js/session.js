/**
 * In-memory view of the signed-in account.
 * The durable session is the httpOnly cookie. Nothing here is written to
 * localStorage, sessionStorage, or IndexedDB.
 */
window.appSession = {
    role: null,
    profile: null,
    signingDid: null,

    apply(payload = {}) {
        const profile = payload.profile || payload.student || payload.user || null;
        this.role = payload.role || profile?.role || null;
        this.profile = profile;
        if (payload.signingDid) this.signingDid = payload.signingDid;
    },

    clear() {
        this.role = null;
        this.profile = null;
        this.signingDid = null;
        window.didManager?.clearMemory?.();
        window.credentialManager?.clearMemory?.();
        window.studentManager?.clearMemory?.();
    },

    field(name) {
        const profile = this.profile || {};
        switch (name) {
            case 'userRole':
                return this.role;
            case 'authSession':
                return this.role ? 'true' : null;
            case 'activeEnrollmentNo':
                return profile.enrollmentNo || null;
            case 'activeStudentEmail':
                return profile.email || null;
            case 'activeStudentName':
                return profile.name || null;
            case 'activeStudentProgram':
                return profile.program || null;
            case 'activeStudentDID':
                return profile.did || this.signingDid?.id || null;
            case 'adminEmail':
                return this.role === 'university' ? (profile.email || null) : null;
            default:
                return null;
        }
    },

    async restore() {
        if (!window.api?.getSession) return false;
        try {
            const data = await window.api.getSession();
            this.apply(data);
            if (data.signingDid) window.didManager?.adopt?.(data.signingDid);
            if (Array.isArray(data.credentials)) {
                await window.credentialManager?.importCredentials?.(data.credentials);
            }
            return true;
        } catch (error) {
            this.clear();
            return false;
        }
    }
};
