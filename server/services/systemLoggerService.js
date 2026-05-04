const SystemExecutionLog = require("../models/SystemExecutionLog");
const { generateWithFallback } = require("./aiService");

class SystemLoggerService {
    /**
     * Start tracking a new execution chain or workflow
     */
    async initiateLog({
        userId,
        workflowId,
        chainId = null,
        agentType,
        triggerSource = "User Command",
        systemLog,
        priority = "Medium",
        state = "Pending"
    }) {
        try {
            const logEntry = new SystemExecutionLog({
                userId,
                workflowId,
                chainId: chainId || workflowId, // Default chainId to workflowId if multi-agent chain isn't explicit
                agentType,
                triggerSource,
                systemLog,
                state,
                priority,
                steps: []
            });
            await logEntry.save();
            return logEntry;
        } catch (error) {
            console.error("[SystemLogger] Failed to initiate log:", error.message);
            return null;
        }
    }

    /**
     * Update the state of an existing execution trace
     */
    async updateState(logId, state) {
        try {
            return await SystemExecutionLog.findByIdAndUpdate(
                logId,
                { $set: { state, lastUpdated: new Date() } },
                { new: true }
            );
        } catch (error) {
            console.error("[SystemLogger] Failed to update state:", error.message);
            return null;
        }
    }

    /**
     * Append a detailed step or micro-log to the trace
     */
    async addStep(logId, {
        label,
        status = "completed",
        message = "",
        retryCount = 0,
        methodSwitched = false,
        metadata = {}
    }) {
        try {
            return await SystemExecutionLog.findByIdAndUpdate(
                logId,
                { 
                    $push: { 
                        steps: { label, status, message, retryCount, methodSwitched, metadata } 
                    },
                    $set: { lastUpdated: new Date() }
                },
                { new: true }
            );
        } catch (error) {
            console.error("[SystemLogger] Failed to add step:", error.message);
            return null;
        }
    }

    /**
     * Conclude the log by setting final state and generating an abstracted user narrative
     */
    async concludeLog(logId, finalState, systemSummary = null) {
        try {
            const logEntry = await SystemExecutionLog.findById(logId);
            if (!logEntry) return null;

            logEntry.state = finalState;
            if (systemSummary) {
                logEntry.systemLog = `${logEntry.systemLog} -> ${systemSummary}`;
            }

            // Generate a User Narrative if it hasn't been set
            if (!logEntry.userNarrative && process.env.OPENAI_API_KEY) {
                const stepSummaries = logEntry.steps.map(s => `[${s.status.toUpperCase()}] ${s.label}: ${s.message || ''}`).join("\n");
                
                const prompt = `
                You are Nurotra's logging abstraction layer.
                Translate the following technical system execution sequence into a clean, human-readable narrative (1-2 sentences).
                The output should sound natural, like a capable assistant telling the user what was done.
                Use a confident, professional tone. If the state is Failed, explain it gently.
                
                Agent Type: ${logEntry.agentType}
                Trigger: ${logEntry.triggerSource}
                Final State: ${finalState}
                System Log: ${logEntry.systemLog}
                Micro Steps:
                ${stepSummaries}
                
                Output ONLY the user narrative statement. Do NOT include greetings or extraneous text.`;

                try {
                    const narrative = await generateWithFallback(prompt, "You are a summarizing agent.");
                    logEntry.userNarrative = narrative.replace(/"/g, '').trim();
                } catch (aiErr) {
                    logEntry.userNarrative = `Execution ${finalState}: ${logEntry.systemLog}`;
                }
            } else if (!logEntry.userNarrative) {
                logEntry.userNarrative = `Task ${finalState.toLowerCase()}: ${logEntry.systemLog}`;
            }

            // Re-evaluate Priority if completed
            if (finalState === "Failed") logEntry.priority = "High";

            await logEntry.save();
            return logEntry;
        } catch (error) {
            console.error("[SystemLogger] Failed to conclude log:", error.message);
            return null;
        }
    }

    /**
     * Retrieve chronological logs for a user, handling contextual search and states
     */
    async getLogs(userId, { state, agentType, priority, searchToken, limit = 50 } = {}) {
        const query = { userId };
        
        if (state) query.state = state;
        if (agentType) query.agentType = agentType;
        if (priority) query.priority = priority;
        if (searchToken) query.searchTokens = { $in: [searchToken.toLowerCase()] };

        try {
            return await SystemExecutionLog.find(query)
                .sort({ timestamp: -1 })
                .limit(limit);
        } catch (error) {
            console.error("[SystemLogger] Failed to fetch logs:", error.message);
            return [];
        }
    }
}

module.exports = new SystemLoggerService();
