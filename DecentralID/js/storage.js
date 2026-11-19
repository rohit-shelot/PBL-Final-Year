/**
 * Browser persistence is limited to the display theme.
 * Accounts, DIDs, credentials, and profiles live in MongoDB.
 * The signed-in session is the httpOnly cookie set by the API.
 */
class StorageManager {
    constructor() {
        this.dbName = 'SSIWalletDB';
    }

    async init() {
        await this.purgeBrowserData();
    }

    async purgeBrowserData() {
        const recordKeys = [
            'authSession',
            'userRole',
            'userData',
            'adminEmail',
            'activeEnrollmentNo',
            'activeStudentEmail',
            'activeStudentName',
            'activeStudentProgram',
            'activeStudentDID',
            'wallet_salt'
        ];
        recordKeys.forEach((key) => localStorage.removeItem(key));
        sessionStorage.removeItem('activeSession');

        if (!window.indexedDB?.deleteDatabase) return;
        await new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
        });
    }

    async save() {
        throw new Error('Browser storage is disabled. Records are stored in MongoDB.');
    }

    async get() {
        return null;
    }

    async getAll() {
        return [];
    }

    async delete() {
        return;
    }
}

window.storageManager = new StorageManager();
