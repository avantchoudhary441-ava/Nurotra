const { MongoClient } = require('mongodb');
const dns = require('dns').promises;
require('dotenv').config();

const uri = process.env.MONGO_URI;

async function run() {
  try {
    console.log("--- DNS DIAGNOSTICS ---");
    const host = uri.split('@')[1].split('/')[0].split('?')[0];
    console.log(`Target Host: ${host}`);
    
    try {
        const srv = await dns.resolveSrv(`_mongodb._tcp.${host}`);
        console.log("SRV Records found:", JSON.stringify(srv, null, 2));
    } catch (e) {
        console.error("DNS SRV Lookup failed:", e.message);
    }

    try {
        const lookup = await dns.lookup(host);
        console.log("Standard Host Lookup:", lookup);
    } catch (e) {
        console.error("Standard Host Lookup failed:", e.message);
    }

    console.log("\n--- CONNECTION TEST ---");
    const client = new MongoClient(uri, { 
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000
    });

    console.log("Attempting to connect to MongoDB...");
    const start = Date.now();
    await client.connect();
    console.log(`Connected successfully in ${Date.now() - start}ms`);
    
    const databasesList = await client.db().admin().listDatabases();
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
    await client.close();

  } catch (e) {
    console.error("Connection failed:", e.message);
    if (e.message.includes("ECONNREFUSED")) {
        console.log("TIP: Connection Refused usually means the port 27017 is blocked by a firewall or the server isn't listening.");
    }
  }
}

run().catch(console.dir);
