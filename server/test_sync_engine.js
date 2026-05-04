require("dotenv").config();
const mongoose = require("mongoose");
const syncEngineService = require("./services/syncEngineService");
const SyncTask = require("./models/SyncTask");
const SyncLog = require("./models/SyncLog");
const SyncMapping = require("./models/SyncMapping");

async function runTest() {
    try {
        console.log("--- STARTING ICPSE INTEGRATION TEST ---");
        
        // Connect to DB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");

        const testUserId = new mongoose.Types.ObjectId("000000000000000000000001");

        // 1. TEST: Event Capture & Auto-Mapping
        console.log("\n1. Testing Event Capture (WhatsApp -> Sheets)...");
        const eventData = {
            name: "Test Customer",
            phone: "+123456789",
            message: "Interested in high-tier subscription.",
            updatedAt: new Date()
        };

        const event = await syncEngineService.captureEvent(
            testUserId,
            "WhatsApp",
            "Contact",
            "received",
            eventData
        );
        console.log("Event captured and normalized.");

        // 2. TEST: Queue Processing
        console.log("\n2. Processing Sync Queue...");
        await syncEngineService.processQueue();
        
        const tasks = await SyncTask.find({ userId: testUserId }).sort({ createdAt: -1 }).limit(5);
        console.log(`Found ${tasks.length} tasks in queue.`);
        tasks.forEach(t => {
            console.log(`Task: ${t.platform} | Status: ${t.status} | Priority: ${t.priority}`);
        });

        // 3. TEST: Conflict Resolution
        console.log("\n3. Testing Conflict Resolution (User vs System)...");
        const sourceData = { name: "New Name", updatedAt: new Date() };
        const systemData = { name: "Old Name", updatedAt: new Date(Date.now() - 10000) };
        
        const resolved = await syncEngineService.resolveConflicts(
            testUserId,
            "Contact",
            sourceData,
            systemData,
            "User"
        );
        console.log("Resolved (source=User):", resolved.name === "New Name" ? "SUCCESS (User wins)" : "FAILED");

        const platformResolved = await syncEngineService.resolveConflicts(
            testUserId,
            "Contact",
            sourceData,
            systemData,
            "Google Sheets" // Sheets is lower priority than System default
        );
        console.log("Resolved (source=Sheets, priority lower):", platformResolved.name === "Old Name" ? "SUCCESS (System wins)" : "FAILED");

        // 4. TEST: Retry Logic
        console.log("\n4. Testing Retry Injection...");
        const failedTask = await SyncTask.findOne({ status: "retrying" });
        if (failedTask) {
            console.log(`Retry Task Found: ${failedTask.platform}. Retry Count: ${failedTask.retryCount}. Next Attempt: ${failedTask.nextAttempt}`);
        } else {
            console.log("No retrying tasks found (Random skip or all succeeded).");
        }

        console.log("\n--- TEST COMPLETED ---");
        process.exit(0);

    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    }
}

runTest();
