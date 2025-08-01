import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.MONGODB_CONNECTION_STRING;
let client;
let db;

export async function connectToDatabase() {
    if (!connectionString) {
        console.log('⚠️ No database connection string found - running without database features');
        return;
    }

    try {
        if (!client) {
            client = new MongoClient(connectionString, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
            });
            await client.connect();
            db = client.db('smartnotes');
            console.log('✅ Connected to MongoDB database');
        }
    } catch (error) {
        console.error('❌ Database connection error:', error);
        console.log('📊 Continuing without database features');
    }
}

export function getDatabase() {
    return db;
}

export async function saveSummary(summaryData) {
    if (!db) {
        throw new Error('Database not connected');
    }
    const collection = db.collection('summaries');
    const result = await collection.insertOne({
        ...summaryData,
        created_at: new Date()
    });
    return { ...summaryData, _id: result.insertedId };
}

export async function getUserSummaries(userId) {
    if (!db) {
        throw new Error('Database not connected');
    }
    const collection = db.collection('summaries');
    // Find all summaries for the user and sort by most recent
    return await collection.find({ user_id: userId }).sort({ created_at: -1 }).toArray();
}

export async function deleteContent(contentId, userId) {
    if (!db) {
        throw new Error('Database not connected');
    }
    if (!ObjectId.isValid(contentId)) {
        throw new Error(`Invalid content ID format: ${contentId}`);
    }
    const collection = db.collection('summaries');
    const result = await collection.deleteOne({ _id: new ObjectId(contentId), user_id: userId });
    return result.deletedCount > 0;
}

export async function getContentById(contentId) {
    if (!db) {
        throw new Error('Database not connected');
    }
    if (!ObjectId.isValid(contentId)) {
        throw new Error(`Invalid content ID format: ${contentId}`);
    }
    const collection = db.collection('summaries');
    const content = await collection.findOne({ _id: new ObjectId(contentId) });
    return content;
}
