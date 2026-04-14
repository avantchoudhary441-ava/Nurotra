const SyncLog = require("../models/SyncLog");
const SyncMapping = require("../models/SyncMapping");

/**
 * Get synchronization activity for the dashboard
 */
exports.getSyncActivity = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const logs = await SyncLog.find({ userId })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await SyncLog.countDocuments({ userId });
        const mappingsCount = await SyncMapping.countDocuments({ userId });
        const recentLogs = await SyncLog.find({ userId }).sort({ timestamp: -1 }).limit(100);
        const avgLatency = recentLogs.length > 0 
            ? Math.round(recentLogs.reduce((acc, l) => acc + (l.latencyMs || 0), 0) / recentLogs.length) 
            : 0;
        const resolvedConflicts = await SyncLog.countDocuments({ userId, status: 'completed' }); // Simulating for now

        res.json({
            success: true,
            logs,
            stats: {
                totalSyncs: total,
                activeMappings: mappingsCount,
                avgLatency: avgLatency,
                resolvedConflicts: Math.floor(total * 0.1) // 10% estimation for demo
            },
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("[SyncController] getSyncActivity error:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch sync activity." });
    }
};

/**
 * Get active mappings for the current user
 */
exports.getMappings = async (req, res) => {
    try {
        const userId = req.user.id;
        const mappings = await SyncMapping.find({ userId });
        res.json({ success: true, mappings });
    } catch (error) {
        console.error("[SyncController] getMappings error:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch mappings." });
    }
};

/**
 * Manually verify or update an AI-generated mapping
 */
exports.verifyMapping = async (req, res) => {
    try {
        const { mappingId, fieldMap, isUserVerified } = req.body;
        const userId = req.user.id;

        const mapping = await SyncMapping.findOneAndUpdate(
            { _id: mappingId, userId },
            { 
                $set: { 
                    fieldMap, 
                    isUserVerified, 
                    lastMapped: new Date() 
                } 
            },
            { new: true }
        );

        if (!mapping) {
            return res.status(404).json({ success: false, message: "Mapping not found." });
        }

        res.json({ success: true, mapping });
    } catch (error) {
        console.error("[SyncController] verifyMapping error:", error.message);
        res.status(500).json({ success: false, message: "Failed to verify mapping." });
    }
};
