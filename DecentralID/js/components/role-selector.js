/**
 * Role Selector Component
 * 
 * Main institutional portal gateway for MIT-ADT University Academic Credential System.
 * Provides explicit, accessible login options for Administrator, Student, and Verifier.
 */
window.roleSelectorComponent = {
    render() {
        const isAdminLoggedIn = localStorage.getItem('userRole') === 'university' && localStorage.getItem('authSession') === 'true';
        const isStudentLoggedIn = localStorage.getItem('userRole') === 'student' && localStorage.getItem('activeEnrollmentNo');
        const isVerifierLoggedIn = localStorage.getItem('userRole') === 'verifier' && localStorage.getItem('authSession') === 'true';

        return `
            <div class="role-selector fade-in-up" style="max-width: 1240px; margin: 0 auto; padding: 1rem;">
                <div class="text-center mb-8">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 1rem;">
                        <img src="assets/mit-adt-logo.png" alt="MIT-ADT University" class="uni-brand-logo" />
                        <h1 style="font-size: 2rem; font-weight: 800; color: var(--text-primary); margin: 0; letter-spacing: -0.02em;">
                            MIT Art, Design and Technology University
                        </h1>
                    </div>
                    <p class="role-selector-intro">Choose the right portal to manage student records, view issued certificates, or verify a certificate.</p>
                </div>

                <div class="role-cards role-cards-horizontal">
                    <!-- University Registrar Role -->
                    <div class="role-card role-card-horizontal" onclick="navigateTo('${isAdminLoggedIn ? 'issuer' : 'uni-login'}')" style="cursor: pointer; border-left: 4px solid var(--brand-purple);">
                        <span class="badge badge-info">Administrative</span>
                        <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--text-primary);">Office of the Registrar</h3>
                        <p>Register students, keep records organised, and issue official certificates from one place.</p>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <button type="button" class="btn btn-primary btn-block" onclick="event.stopPropagation(); navigateTo('${isAdminLoggedIn ? 'issuer' : 'uni-login'}')" style="padding: 0.65rem 1rem; font-weight: 600; font-size: 0.88rem;">
                                ${isAdminLoggedIn ? 'Open Registrar Portal' : 'Administrator Sign In'}
                            </button>
                        </div>
                    </div>

                    <!-- Student Role -->
                    <div class="role-card role-card-horizontal" onclick="navigateTo('${isStudentLoggedIn ? 'dashboard' : 'student-login'}')" style="cursor: pointer; border-left: 4px solid var(--accent-green);">
                        <span class="badge badge-success">Student Access</span>
                        <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--text-primary);">Student Portal</h3>
                        <p>View your academic details and keep your issued certificates ready to share when needed.</p>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <button type="button" class="btn btn-success btn-block" onclick="event.stopPropagation(); navigateTo('${isStudentLoggedIn ? 'dashboard' : 'student-login'}')" style="padding: 0.65rem 1rem; font-weight: 600; font-size: 0.88rem; background: var(--accent-green); color: #fff; border: none;">
                                ${isStudentLoggedIn ? 'Open Student Portal' : 'Student Login'}
                            </button>
                        </div>
                    </div>

                    <!-- Verifier Role -->
                    <div class="role-card role-card-horizontal" onclick="navigateTo('${isVerifierLoggedIn ? 'verifier' : 'verifier-login'}')" style="cursor: pointer; border-left: 4px solid var(--accent-blue);">
                        <span class="badge badge-warning">Verification Agency</span>
                        <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--text-primary);">Verification Portal</h3>
                        <p>Quickly check whether a student certificate is genuine and issued by the university.</p>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <button type="button" class="btn btn-primary btn-block" onclick="event.stopPropagation(); navigateTo('${isVerifierLoggedIn ? 'verifier' : 'verifier-login'}')" style="padding: 0.65rem 1rem; font-weight: 600; font-size: 0.88rem; background: var(--accent-blue); color: #fff; border: none;">
                                ${isVerifierLoggedIn ? 'Open Verification Portal' : 'Verify Credentials'}
                            </button>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 3.5rem; text-align: center; color: var(--text-tertiary); font-size: 0.82rem; border-top: 1px solid var(--border-subtle); padding-top: 1.5rem;">
                    Governed by MIT Art, Design and Technology University, Pune • Conforms to W3C Verifiable Credentials Data Model & W3C DID Standard
                </div>
            </div>
        `;
    },

    init() {
        console.log('Institutional role gateway initialized');
    },

    handleUniversityRoleClick() {
        navigateTo('uni-login');
    },

    handleStudentRoleClick() {
        navigateTo('student-login');
    },

    handleVerifierRoleClick() {
        navigateTo('verifier-login');
    }
};
