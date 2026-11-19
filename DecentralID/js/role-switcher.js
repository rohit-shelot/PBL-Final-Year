/**
 * Role-Based Identity State Synchronizer
 * Automatically synchronizes the active cryptographic DID based on the
 * authenticated session role (University Registrar vs Student).
 */
(function () {
    const ISSUER_ALIAS = 'MIT-ADT Issuer';

    async function applyRole() {
        const role = localStorage.getItem('userRole') || 'student';
        const dids = await window.storageManager.getAll('dids');

        if (role === 'university') {
            let issuer = dids ? dids.find(d => d.alias === ISSUER_ALIAS) : null;
            if (!issuer) {
                issuer = await window.didManager.createDID(ISSUER_ALIAS);
            }
            window.didManager.activeDID = issuer;
        } else {
            const activeStudentDID = localStorage.getItem('activeStudentDID');
            const student = dids
                ? (dids.find(d => d.id === activeStudentDID) || dids.find(d => d.alias !== ISSUER_ALIAS))
                : null;
            window.didManager.activeDID = student || null;
        }
    }

    const originalInit = window.didManager.init.bind(window.didManager);
    window.didManager.init = async function () {
        await originalInit();
        await applyRole();
    };

    // Public helper to switch role context
    window.setSessionRole = async function (role) {
        localStorage.setItem('userRole', role);
        await applyRole();
    };
})();
