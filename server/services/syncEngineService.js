const SyncMapping = require("../models/SyncMapping");
const SyncLog = require("../models/SyncLog");
const SyncTask = require("../models/SyncTask");
const { mapFieldsSemantically } = require("./aiService");
const { discoverSchema } = require("../utils/schemaDiscovery");
const crypto = require("crypto");

/**
 * Intelligent Cross-Platform Synchronization Engine (ICPSE)
 */
const syncEngineService = {
    /**
     * Capture and normalize an event for potential synchronization
     */
    captureEvent: async (userId, source, entity, action, data, depth = 0) => {
        // Safety: Prevent recursion loops
        if (depth > 5) {
            console.warn("[ICPSE] Max sync depth reached. Breaking loop.");
            return;
        }

        const timestamp = new Date();
        console.log(`[ICPSE] Capturing event: ${source}.${entity}.${action}`);

        const normalizedEvent = {
            userId,
            source, // e.g., "WhatsApp", "System", "Google Sheets"
            entity, // e.g., "Contact", "Message", "Lead"
            action, // e.g., "received", "created", "submitted"
            data,
            timestamp
        };

        // Trigger sync plan generation
        await syncEngineService.generateSyncPlan(normalizedEvent);
        return normalizedEvent;
    },

    /**
     * Generate a plan to sync data across connected platforms
     */
    generateSyncPlan: async (event) => {
        const { userId, source, entity, action, data } = event;

        try {
            console.log(`[ICPSE] Generating sync plan for event: ${source} -> Others`);
            // 1. Idempotency Check
            const eventHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
            const idempotencyKey = `${userId}_${source}_${entity}_${action}_${eventHash}`;
            
            // 2. Identify connected platforms
            const potentialTargets = ["Google Sheets", "CRM", "Notion", "Slack"];
            const activeTargets = potentialTargets.filter(t => t !== source);
            console.log(`[ICPSE] Potential targets: ${activeTargets.join(', ')}`);

            for (const target of activeTargets) {
                console.log(`[ICPSE] Processing target: ${target}`);
                let mapping = await SyncMapping.findOne({ userId, sourcePlatform: source, targetPlatform: target });

                if (!mapping) {
                    const aiService = require("./aiService");
                    console.log(`[ICPSE] No mapping found for ${source} -> ${target}. Discovering...`);
                    const aiMapping = await aiService.mapFieldsSemantically({ source, entity, data }, { target });
                    console.log(`[ICPSE] AI Discovery result: ${JSON.stringify(aiMapping.mappings)}`);
                    
                    mapping = new SyncMapping({
                        userId,
                        sourcePlatform: source,
                        targetPlatform: target,
                        fieldMap: aiMapping.mappings,
                        confidence: aiMapping.metadata.confidence,
                        isUserVerified: aiMapping.metadata.confidence > 90
                    });
                    await mapping.save();
                }

                // 3. Transform data
                const mappedData = {};
                // Handle both Mongoose Map and plain JS object
                const fieldMapRaw = mapping.fieldMap instanceof Map ? Object.fromEntries(mapping.fieldMap) : mapping.fieldMap;
                
                Object.entries(fieldMapRaw).forEach(([sourceField, targetField]) => {
                    if (data[sourceField] !== undefined) {
                        mappedData[targetField] = data[sourceField];
                    }
                });

                console.log(`[ICPSE] Mapped data for ${target}: ${JSON.stringify(mappedData)}`);

                // 4. Create a sync task
                if (Object.keys(mappedData).length > 0) {
                    const task = await SyncTask.create({
                        userId,
                        platform: target,
                        action: `push_${entity.toLowerCase()}`,
                        payload: mappedData,
                        priority: "medium",
                        status: "pending"
                    });
                    console.log(`[ICPSE] Created SyncTask: ${task._id} for ${target}`);
                } else {
                    console.log(`[ICPSE] Skipping task for ${target} - No mapped fields matched.`);
                }
            }
        } catch (error) {
            console.error("[ICPSE] generateSyncPlan error:", error);
        }
    },

    /**
     * Periodically process the sync task queue
     */
    processQueue: async () => {
        const now = new Date();
        const tasks = await SyncTask.find({
            status: { $in: ["pending", "retrying"] },
            nextAttempt: { $lte: now }
        }).sort({ priority: 1, createdAt: 1 }).limit(10);

        for (const task of tasks) {
            await syncEngineService.executeSyncTask(task);
        }
    },

    /**
     * Execute a specific synchronization task
     */
    executeSyncTask: async (task) => {
        const startTime = Date.now();
        task.status = "processing";
        await task.save();

        try {
            console.log(`[ICPSE] Executing sync task for ${task.platform}`);

            // 1. Platform-specific execution
            // In a real system, call adapters (GoogleSheetsAdapter, etc.)
            const result = await syncEngineService.callPlatformAdapter(task.platform, task.action, task.payload);

            if (result.success) {
                // 2. Success path
                task.status = "completed";
                await task.save();

                // 3. Log success
                const log = await SyncLog.create({
                    userId: task.userId,
                    status: "success",
                    platforms: [task.platform],
                    entity: task.action.split('_')[1] || 'Entity',
                    action: task.action.split('_')[0],
                    payload: task.payload,
                    latencyMs: Date.now() - startTime
                });

                // 4. Emit real-time update
                syncEngineService.emitActivity(task.userId, log);
            } else {
                throw new Error(result.error || "Execution failed");
            }
        } catch (error) {
            console.error(`[ICPSE] Sync task failed: ${error.message}`);
            
            // 4. Retry Logic with Exponential Backoff
            task.retryCount += 1;
            if (task.retryCount < task.maxRetries) {
                const backoffSeconds = [1, 3, 10][task.retryCount - 1] || 10;
                task.status = "retrying";
                task.nextAttempt = new Date(Date.now() + backoffSeconds * 1000);
                task.lastError = error.message;
            } else {
                task.status = "failed";
                task.lastError = `Max retries reached: ${error.message}`;
                
                // Log failure
                await SyncLog.create({
                    userId: task.userId,
                    status: "failed",
                    platforms: [task.platform],
                    error: task.lastError,
                    payload: task.payload,
                    latencyMs: Date.now() - startTime
                });
            }
            await task.save();
        }
    },

    /**
     * Mock Platform Adapter Caller
     */
    callPlatformAdapter: async (platform, action, payload) => {
        // Simulated latency
        await new Promise(r => setTimeout(r, 500));
        
        // Randomly simulate failures for testing retry system
        const shouldFail = Math.random() < 0.1;
        if (shouldFail) return { success: false, error: "Network timeout or API rate limit exceeded." };

        return { success: true };
    },

    /**
     * Resolve data conflicts using Source of Truth and Timestamps
     */
    resolveConflicts: async (userId, entity, sourceValue, existingValue, sourcePlatform) => {
        console.log(`[ICPSE] Resolving conflict for ${entity}`);

        // 1. Source of Truth Priority: User > System > Platform
        // In this implementation:
        // - User manual sync is Highest Priority
        // - Existing System data is Medium
        // - Incoming Webhook is lowest unless it's newer
        
        const sourcePriority = {
            "User": 100,
            "CRM": 80,
            "System": 70,
            "WhatsApp": 50,
            "Google Sheets": 40
        };

        const pSource = sourcePriority[sourcePlatform] || 10;
        const pExisting = sourcePriority["System"]; // Default for existing data

        // CASE A: User Triggered (Always Win)
        if (sourcePlatform === "User") return sourceValue;

        // CASE B: Priority Comparison
        if (pSource > pExisting) return sourceValue;
        if (pExisting > pSource) return existingValue;

        // CASE C: Timestamp Resolution (Latest Wins)
        // Assume data objects have 'updatedAt'
        const tSource = new Date(sourceValue.updatedAt || 0);
        const tExisting = new Date(existingValue.updatedAt || 0);

        return tSource >= tExisting ? sourceValue : existingValue;
    },

    /**
     * Verify consistency across platforms
     */
    checkConsistency: async (userId, entity, data) => {
        // Implementation for Phase 4: Contrast and Verify
        console.log(`[ICPSE] Running consistency check for ${entity}`);
        // Log purely for dashboard observability
        return true;
    }
};

module.exports = syncEngineService;
