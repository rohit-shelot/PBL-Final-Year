const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

let db = null;
let client = null;
let connectionPromise = null;

async function connectDB() {
    if (db) {
        return db;
    }

    // Prevent startup and retry code from opening concurrent clients.
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = connect();
    try {
        return await connectionPromise;
    } finally {
        connectionPromise = null;
    }
}

async function connect() {
    let pendingClient = null;
    let uri;
    try {
        uri = process.env.MONGODB_URI;

        if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
            throw new Error('Please configure your MongoDB Atlas connection string in .env file');
        }

        const uriDatabaseName = new URL(uri).pathname.replace(/^\/+/, '');
        const databaseName = process.env.MONGODB_DB?.trim() || uriDatabaseName || 'ssi_auth';

        const configuredTimeout = Number.parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10);
        const serverSelectionTimeoutMS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
            ? configuredTimeout
            : 30000;
        const usesAtlasSrv = uri.startsWith('mongodb+srv://');

        pendingClient = new MongoClient(uri, {
            // Atlas SRV connections use TLS. For a local mongodb:// URI, leave
            // TLS to the connection string instead of forcing it on.
            ...(usesAtlasSrv ? { tls: true } : {}),
            appName: 'DecentralID',
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            // The driver's documented default is 30 seconds. Five seconds can
            // fail on a healthy Atlas cluster during initial DNS/TLS discovery.
            serverSelectionTimeoutMS,
            connectTimeoutMS: Math.min(serverSelectionTimeoutMS, 10000)
        });

        await pendingClient.connect();
        await pendingClient.db("admin").command({ ping: 1 });

        client = pendingClient;
        db = client.db(databaseName);
        console.log('✓ Successfully connected to MongoDB Atlas!');

        // Create indexes for unique fields
        await db.collection('universities').createIndex({ email: 1 }, { unique: true });
        await db.collection('verifiers').createIndex({ orgId: 1 }, { unique: true });
        await db.collection('students').createIndex({ enrollmentNo: 1 }, { unique: true });
        await db.collection('students').createIndex({ email: 1 }, { unique: true });
        await db.collection('credentials').createIndex({ id: 1 }, { unique: true });
        await db.collection('credentials').createIndex({ recipientEnrollmentNo: 1 });
        await db.collection('selective_presentations').createIndex({ id: 1 }, { unique: true });
        await db.collection('dids').createIndex({ id: 1 }, { unique: true });
        await db.collection('dids').createIndex({ ownerEmail: 1, ownerRole: 1 });
        await db.collection('dids').createIndex({ ownerEnrollmentNo: 1 });

        return db;
    } catch (error) {
        // A failed TLS/network connection may still own sockets. Release it
        // before the scheduled retry opens another client.
        if (pendingClient) {
            await pendingClient.close().catch(() => {});
        }
        console.error('✗ MongoDB connection error:', error.message);
        if (uri?.startsWith('mongodb+srv://')) {
            console.error('Atlas connection hint: in Atlas Web, add this machine\'s public IP under Security > Network Access, then allow outbound TCP port 27017 to *.mongodb.net on this network.');
        }
        throw error;
    }
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB() first.');
    }
    return db;
}

function getClient() {
    if (!client) {
        throw new Error('Database not initialized. Call connectDB() first.');
    }
    return client;
}

/**
 * Run related MongoDB writes in one transaction so a failure rolls every
 * document back. Atlas provides the replica set this requires.
 */
async function withTransaction(work) {
    const mongoClient = getClient();
    const session = mongoClient.startSession();
    try {
        return await session.withTransaction(async () => work(session));
    } finally {
        await session.endSession();
    }
}

async function closeDB() {
    if (client) {
        await client.close();
        db = null;
        client = null;
        console.log('✓ MongoDB connection closed');
    }
}

module.exports = { connectDB, getDB, getClient, closeDB, withTransaction };
