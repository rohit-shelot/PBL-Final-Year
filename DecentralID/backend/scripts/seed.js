require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectDB, closeDB } = require('../config/database');
const User = require('../models/User');

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');

        const required = (name) => {
            const value = process.env[name]?.trim();
            if (!value) throw new Error(`${name} must be set in backend/.env before seeding`);
            return value;
        };

        // Connect to database
        await connectDB();

        // Admin University User from .env
        const adminEmail = required('ADMIN_EMAIL').toLowerCase();
        const adminPassword = required('ADMIN_PASSWORD');
        const adminOrg = required('ADMIN_ORG_NAME');

        await User.upsertUniversity(adminEmail, adminPassword, adminOrg);
        console.log('✓ Seeded/Updated Authorized Administrator:', adminEmail);

        // Verifier User from .env
        const verifierOrgId = required('VERIFIER_ORG_ID');
        const verifierPassword = required('VERIFIER_PASSWORD');
        const verifierOrgName = required('VERIFIER_ORG_NAME');

        await User.upsertVerifier(verifierOrgId, verifierPassword, verifierOrgName);
        console.log('✓ Seeded/Updated verifier user:', verifierOrgId);

        console.log('\n========================================');
        console.log('✓ Database Seeding Completed Successfully');
        console.log('========================================');
        console.log('Administrator Portal:');
        console.log(`  Email:    ${adminEmail}`);
        console.log('Verifier Portal:');
        console.log(`  Org ID:   ${verifierOrgId}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('✗ Seeding error:', error);
    } finally {
        await closeDB();
        process.exit(0);
    }
}

seedDatabase();
