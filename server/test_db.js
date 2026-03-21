const { MongoClient } = require('mongodb');
require('dotenv').config();

async function test() {
    console.log('Testing connection to:', process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@'));
    const client = new MongoClient(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully to server');
        const db = client.db();
        console.log('Database name:', db.databaseName);
        await client.close();
    } catch (err) {
        console.error('❌ Connection failed:');
        console.error(err);
    }
}

test();
