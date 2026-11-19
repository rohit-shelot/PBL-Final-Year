/**
 * Main Application Controller
 * 
 * Orchestrates the SSI Wallet application, manages routing and initialization.
 */
class SSIApp {
    constructor() {
        this.currentView = null;
        this.components = {};
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('🚀 Initializing SSI Wallet...');

        try {
            // Show loading screen
            this.showLoading();

            // Initialize core systems
            await window.storageManager.init();
            await window.didManager.init();
            await window.credentialManager.init();

            // Check if user has a DID (onboarding complete)
            const hasDID = window.didManager.activeDID !== null;

            // Hide loading, show main content
            this.hideLoading();

            // Route to initial role selection
            this.navigateTo('role-select');

            console.log('✓ SSI Wallet initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    /**
     * Show loading screen
     */
    showLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        const mainContent = document.getElementById('main-content');

        if (loadingScreen) loadingScreen.classList.remove('hidden');
        if (mainContent) mainContent.classList.add('hidden');
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        const mainContent = document.getElementById('main-content');

        setTimeout(() => {
            if (loadingScreen) loadingScreen.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');
        }, 500);
    }

    /**
     * Navigate to a view
     */
    navigateTo(view) {
        switch (view) {
            case 'onboarding':
                this.showOnboarding();
                break;
            case 'dashboard':
                this.showDashboard();
                break;
            case 'issuer':
                this.showIssuer();
                break;
            case 'holder':
                this.showHolder();
                break;
            case 'verifier':
                this.showVerifier();
                break;
            case 'role-select':
                this.showRoleSelector();
                break;
            case 'uni-login':
                this.showUniversityLogin();
                break;
            case 'verifier-login':
                this.showVerifierLogin();
                break;
            case 'student-login':
                this.showStudentLogin();
                break;
            default:
                this.showRoleSelector();
        }
    }

    /**
     * Show onboarding flow
     */
    showOnboarding() {
        this.currentView = 'onboarding';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.onboardingComponent.render();
        window.onboardingComponent.init();
    }

    /**
     * Show dashboard (Guarded by Student RBAC)
     */
    showDashboard() {
        const role = localStorage.getItem('userRole');
        const erno = localStorage.getItem('activeEnrollmentNo');

        if (role !== 'student' || !erno) {
            this.showStudentLogin();
            return;
        }

        this.currentView = 'dashboard';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.dashboardComponent.render();
        window.dashboardComponent.init();
    }

    /**
     * Show issuer interface (Guarded by RBAC)
     */
    showIssuer() {
        const role = localStorage.getItem('userRole');
        const hasSession = localStorage.getItem('authSession') === 'true';

        if (!hasSession || role !== 'university') {
            this.showError('Access restricted: Administrator authentication required to enter the University Portal.');
            this.showUniversityLogin();
            return;
        }

        this.currentView = 'issuer';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.credentialIssuerComponent.render();
        window.credentialIssuerComponent.init();
    }

    /**
     * Show holder interface (Guarded by Student RBAC)
     */
    showHolder() {
        const role = localStorage.getItem('userRole');
        const erno = localStorage.getItem('activeEnrollmentNo');

        if (role !== 'student' || !erno) {
            this.showStudentLogin();
            return;
        }

        this.currentView = 'holder';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.credentialHolderComponent.render();
        window.credentialHolderComponent.init();
    }

    /**
     * Show verifier interface (Guarded by RBAC)
     */
    showVerifier() {
        const role = localStorage.getItem('userRole');
        const hasSession = localStorage.getItem('authSession') === 'true';

        if (!hasSession || role !== 'verifier') {
            this.showError('Access restricted: Please sign in to access the Verifier Portal.');
            this.showVerifierLogin();
            return;
        }

        this.currentView = 'verifier';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.credentialVerifierComponent.render();
        window.credentialVerifierComponent.init();
    }

    /**
     * Logout current session
     */
    logout() {
        window.api?.logout?.();
        localStorage.removeItem('authSession');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userData');
        localStorage.removeItem('adminEmail');
        localStorage.removeItem('activeEnrollmentNo');
        localStorage.removeItem('activeStudentEmail');
        localStorage.removeItem('activeStudentName');
        localStorage.removeItem('activeStudentProgram');
        localStorage.removeItem('activeStudentDID');
        this.showSuccess('You have been signed out successfully.');
        this.navigateTo('role-select');
    }

    /**
     * Show Role Selector
     */
    showRoleSelector() {
        this.currentView = 'role-select';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.roleSelectorComponent.render();
        window.roleSelectorComponent.init();
    }

    /**
     * Show Student Login (Gateway)
     */
    showStudentLogin() {
        this.currentView = 'student-login';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.studentLoginComponent.render();
        window.studentLoginComponent.init();
    }

    /**
     * Show University Login
     */
    showUniversityLogin() {
        this.currentView = 'uni-login';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.universityLoginComponent.render();
        window.universityLoginComponent.init();
    }

    /**
     * Show Verifier Login
     */
    showVerifierLogin() {
        this.currentView = 'verifier-login';
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = window.verifierLoginComponent.render();
        window.verifierLoginComponent.init();
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showToast(message, 'error');
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    /**
     * Refresh current view
     */
    refresh() {
        this.navigateTo(this.currentView || 'dashboard');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SSIApp();
    window.app.init();
});

// Global navigation helper
function navigateTo(view) {
    window.app.navigateTo(view);
}
