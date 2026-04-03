const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

async function run() {
  try {
    console.log("Attempting to connect to MongoDB...");
    await client.connect();
    console.log("Connected successfully to server");
    const databasesList = await client.db().admin().listDatabases();
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
  } catch (e) {
    console.error("Connection failed:", e.message);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
