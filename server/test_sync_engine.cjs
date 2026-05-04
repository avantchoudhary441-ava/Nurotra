require('dotenv').config();
const mongoose = require('mongoose');
const syncEngineService = require('./services/syncEngineService');
const SyncMapping = require('./models/SyncMapping');
const SyncLog = require('./models/SyncLog');
const SyncTask = require('./models/SyncTask');

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/nurotra";
const TEST_USER_ID = new mongoose.Types.ObjectId("000000000000000000000001");

// --- MOCK AI SERVICE FOR TESTING ---
const aiService = require('./services/aiService');
aiService.mapFieldsSemantically = async (sourceStruct, targetSchemaPreview) => {
    console.log(`[Test Mock] Simulating AI semantic mapping for ${targetSchemaPreview.target}...`);
    // Return a mocked mapping that works for the test payload
    return {
        mappings: new Map([
            ["contact_name", "name"],
            ["message_body", "note"],
            ["priority", "urgency"]
        ]),
        metadata: { confidence: 95 }
    };
};
// -----------------------------------

async function runTest() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected.");

        // Clean up previous test data if needed (optional)
        // await SyncTask.deleteMany({ userId: TEST_USER_ID });

        console.log("\n--- TEST 1: Capture WhatsApp Event ---");
        const eventData = {
            contact_name: "John Doe",
            message_body: "I am interested in your services. Please add me to the CRM.",
            priority: "high",
            timestamp: new Date()
        };

        const event = await syncEngineService.captureEvent(
            TEST_USER_ID, 
            "WhatsApp", 
            "Message", 
            "received", 
            eventData
        );

        console.log("Event Captured:", event ? "SUCCESS" : "FAILED");

        // Wait for async background work (if any) or check DB manually
        console.log("\nChecking for generated SyncTasks...");
        const tasks = await SyncTask.find({ userId: TEST_USER_ID }).sort({ createdAt: -1 }).limit(5);
        console.log(`Found ${tasks.length} pending tasks.`);
        tasks.forEach(t => {
            console.log(` - Target: ${t.platform}, Action: ${t.action}, Status: ${t.status}`);
        });

        console.log("\n--- TEST 2: Process Queue ---");
        await syncEngineService.processQueue();
        
        const updatedTasks = await SyncTask.find({ userId: TEST_USER_ID }).sort({ createdAt: -1 }).limit(5);
        console.log("Tasks processed. New statuses:");
        updatedTasks.forEach(t => {
            console.log(` - Target: ${t.platform}, Status: ${t.status}, Payload: ${JSON.stringify(t.payload).substring(0, 50)}...`);
        });

        console.log("\n--- TEST 3: Conflict Resolution ---");
        const existingVal = { name: "Old Name", priority: "low", updatedAt: new Date(Date.now() - 100000) };
        const sourceVal = { name: "New Name", priority: "high", updatedAt: new Date() };
        
        const resolution = await syncEngineService.resolveConflicts(
            TEST_USER_ID, 
            "Lead", 
            sourceVal, 
            existingVal, 
            "WhatsApp"
        );
        console.log("Resolved Value:", resolution.name === "New Name" ? "SUCCESS (New wins)" : "FAILED (Old wins)");

    } catch (error) {
        console.error("Test Failed with Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB.");
    }
}

runTest();
