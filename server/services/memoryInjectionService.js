const SystemExecutionLog = require("../models/SystemExecutionLog");

class MemoryInjectionService {
    /**
     * Retrieve the recent operational context for the orchestrator
     * This compiles the recent execution history into a neat prompt block.
     * @param {String} userId 
     * @param {Number} lookbackHours 
     * @returns {String} formatted context string
     */
    async getRecentContextString(userId, lookbackHours = 24) {
        try {
            const lookbackTime = new Date(Date.now() - (lookbackHours * 60 * 60 * 1000));
            const recentLogs = await SystemExecutionLog.find({
                userId,
                timestamp: { $gte: lookbackTime },
                state: { $in: ["Completed", "Failed"] }
            })
            .sort({ timestamp: -1 })
            .limit(20);

            if (!recentLogs.length) {
                return "Recent Execution History: No major actions taken recently.";
            }

            const logStrings = recentLogs.map(log => 
                `[${log.timestamp.toLocaleTimeString()}] [${log.agentType}] [${log.state}] ${log.userNarrative || log.systemLog}`
            ).join("\n");

            return `Recent Execution History (Past ${lookbackHours}h):\n${logStrings}\nUse this context if the user asks 'what did you do today' or refers to a recent action.`;
        } catch (error) {
            console.error("[MemoryInjection] Failed to load recent context:", error.message);
            return "Recent Execution History: Unavailable.";
        }
    }

    /**
     * Detect regular patterns to suggest automation to the user
     * Currently a lightweight version that checks if the same agent + search token is used heavily.
     */
    async identifyAutomationOpportunities(userId) {
        try {
            // Fetch logs from the last 7 days
            const lookback = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
            const weeklyLogs = await SystemExecutionLog.find({
                userId,
                timestamp: { $gte: lookback },
                state: "Completed",
                agentType: { $ne: "Orchestrator" }
            });

            if (weeklyLogs.length < 5) return [];

            // A very simple heuristic: if a specific agent does the same system log keyword multiple times
            // This would normally be much more advanced (e.g. LLM aggregation)
            const typeCounts = {};
            weeklyLogs.forEach(log => {
                const key = `${log.agentType}::${log.priority}`;
                typeCounts[key] = (typeCounts[key] || 0) + 1;
            });

            const suggestions = [];
            for (const [key, count] of Object.entries(typeCounts)) {
                if (count >= 3) {
                    const [agentType, priority] = key.split("::");
                    suggestions.push({
                        type: "automation_suggestion",
                        trigger: "frequent_execution",
                        message: `You frequently use the ${agentType} for ${priority} priority tasks. Would you like me to set up an automatic scheduled run for this?`
                    });
                }
            }

            return suggestions;
        } catch (error) {
            console.error("[MemoryInjection] Failed to identify opportunities:", error.message);
            return [];
        }
    }
}

module.exports = new MemoryInjectionService();
