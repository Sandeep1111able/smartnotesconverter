import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
    const connectionString = process.env.MONGODB_CONNECTION_STRING;
    
    console.log('🔍 Testing MongoDB connection...');
    console.log('Connection string exists:', !!connectionString);
    
    if (!connectionString) {
        console.log('❌ No connection string found');
        return;
    }
    
    try {
        const client = new MongoClient(connectionString, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        console.log('🔄 Attempting to connect...');
        await client.connect();
        console.log('✅ Successfully connected to MongoDB');
        
        const db = client.db('smartnotes');
        const collection = db.collection('summaries');
        
        // Test insert
        const testDoc = {
            test: true,
            timestamp: new Date(),
            message: 'Connection test successful'
        };
        
        const result = await collection.insertOne(testDoc);
        console.log('✅ Test insert successful:', result.insertedId);
        
        // Clean up test document
        await collection.deleteOne({ _id: result.insertedId });
        console.log('✅ Test cleanup successful');
        
        await client.close();
        console.log('✅ Connection test completed successfully');
        
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        console.error('Full error:', error);
    }
}

testConnection(); 