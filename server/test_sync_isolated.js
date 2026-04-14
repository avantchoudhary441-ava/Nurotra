require("dotenv").config();
const mongoose = require("mongoose");

// Manual Mocking of AI Service to avoid recursive loading
const mockAiService = {
    mapFieldsSemantically: async () => ({
        mappings: { "name": "client_name", "phone": "phone_number" },
        metadata: { confidence: 95, reasoning: "Mocked mapping for test." }
    })
};

// Override the require for aiService in the engine
// Note: This is a hacky way to test without changing the source code too much
const syncEngineService = require("./services/syncEngineService");
syncEngineService.mapFieldsSemantically = mockAiService.mapFieldsSemantically;

const SyncTask = require("./models/SyncTask");
const SyncLog = require("./models/SyncLog");
const SyncMapping = require("./models/SyncMapping");

async function runTest() {
    try {
        console.log("--- STARTING ISOLATED ICPSE TEST ---");
        
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            console.error("MONGO_URI missing from .env");
            process.exit(1);
        }

        await mongoose.connect(uri);
        console.log("Connected to MongoDB.");

        const testUserId = new mongoose.Types.ObjectId("000000000000000000000001");

        // Clean up previous test data
        await SyncTask.deleteMany({ userId: testUserId });
        await SyncLog.deleteMany({ userId: testUserId });
        // We keep mappings to test "find" vs "create"

        // 1. TEST: Event Capture & Auto-Mapping
        console.log("\n[TEST 1] Event Capture (Trigger: WhatsApp)...");
        const eventData = {
            name: "Test User Isolation",
            phone: "+999888777",
            status: "active"
        };

        await syncEngineService.captureEvent(testUserId, "WhatsApp", "Lead", "created", eventData);
        console.log("SUCCESS: Lead captured.");

        // 2. TEST: Mapping Check
        const mapping = await SyncMapping.findOne({ userId: testUserId, sourcePlatform: "WhatsApp", targetPlatform: "Google Sheets" });
        if (mapping) {
            console.log(`SUCCESS: Mapping found with ${Object.keys(mapping.fieldMap).length} fields mapped.`);
        } else {
            console.warn("WARNING: Mapping not created (Check mapFieldsSemantically call).");
        }

        // 3. TEST: Queue Processing (Simulating Execution)
        console.log("\n[TEST 2] Processing Queue...");
        await syncEngineService.processQueue();
        
        const logs = await SyncLog.find({ userId: testUserId }).sort({ timestamp: -1 });
        if (logs.length > 0) {
            console.log(`SUCCESS: Processed ${logs.length} sync tasks. First Status: ${logs[0].status}`);
        } else {
            console.log("No logs found. Check SyncTask creations.");
        }

        // 4. TEST: Consistency/Priority Logic
        console.log("\n[TEST 3] Conflict Resolution Logic Check...");
        const update1 = { val: "Alpha", updatedAt: new Date(Date.now() - 5000) };
        const update2 = { val: "Beta", updatedAt: new Date() };
        
        const res = await syncEngineService.resolveConflicts(testUserId, "Test", update1, update2, "User");
        console.log("Resolution (Source=User):", res.val === "Alpha" ? "SUCCESS (Priority Win)" : "FAILED");

        const res2 = await syncEngineService.resolveConflicts(testUserId, "Test", update1, update2, "Slack");
        console.log("Resolution (Source=Slack, older):", res2.val === "Beta" ? "SUCCESS (Timestamp Win)" : "FAILED");

        console.log("\n--- ISOLATED TEST COMPLETED ---");
        process.exit(0);

    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    }
}

runTest();
