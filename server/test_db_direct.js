const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testConnection() {
    const uri = process.env.MONGO_URI;
    console.log("Attempting direct MongoDB driver connection to:", uri.replace(/:([^@]+)@/, ':****@'));
    
    const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
    });

    try {
        console.log("Connecting...");
        await client.connect();
        console.log("✅ Successfully connected via standard driver!");
        
        const db = client.db();
        const collections = await db.listCollections().toArray();
        console.log("Collections in DB:", collections.map(c => c.name));
        
    } catch (err) {
        console.error("❌ Connection failed:", err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        await client.close();
        process.exit();
    }
}

testConnection();
