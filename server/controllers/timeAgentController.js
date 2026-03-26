const intentAnalyzer = require("../services/agents/intentAnalyzer");
const temporalPlanner = require("../services/agents/temporalPlanner");
const { getTemporalContext } = require("../utils/timeHelper");

const docsAgentService = require("../services/docsAgentService");

/**
 * Time Agent Planning Endpoint
 * POST /api/time-agent/plan
 */
const planTask = async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: "Task prompt is required" });
    }

    try {
        console.log(`[TimeAgent] Analyzing temporal goal: "${prompt}"`);

        // 1. Get current ground truth time
        const temporalContext = getTemporalContext();

        // 2. Extract Intent (Deadline, Urgency, Topic, Agents)
        const intent = await intentAnalyzer.analyzeIntent(prompt, "", [], temporalContext);
        console.log(`[TimeAgent] Deadline: ${intent.deadline} | Docs Req: ${intent.requires_docs}`);

        // 3. Parallel Execution: Generate Temporal Schedule & Handle Coordination
        const planningPromise = temporalPlanner.generateTimeline(prompt, intent, temporalContext);

        let docResult = null;
        if (intent.requires_docs || (intent.agents && intent.agents.includes("docs"))) {
            console.log(`[TimeAgent] Coordination Triggered: Starting Docs Agent...`);
            try {
                // We run this in parallel or wait depending on complexity
                // For now, we'll wait to ensure the user gets the download link immediately
                docResult = await docsAgentService.generateFullDocument(req.user, { prompt });
            } catch (docErr) {
                console.warn("[TimeAgent] Docs coordination failed, continuing with plan only:", docErr.message);
            }
        }

        const planning = await planningPromise;
        console.log(`[TimeAgent] Schedule Generated: ${planning.totalPhases} phases.`);

        // 4. Return coordinated result to frontend
        res.json({
            success: true,
            intent,
            planning,
            document: docResult ? {
                id: docResult.document._id,
                name: docResult.document.name,
                type: docResult.type,
                status: 'ready'
            } : null,
            coordination: {
                agents: intent.agents || ["time"],
                status: docResult ? "Document synchronized with timeline" : "Standalone temporal plan"
            },
            message: docResult
                ? `I have planned your execution strategy and initialized the **Docs Agent** to generate your ${docResult.type}. It is ready for download.`
                : `Time Agent has planned your execution strategy based on the ${intent.deadline || 'requested'} deadline.`
        });

    } catch (error) {
        console.error("[TimeAgent] Planning failed:", error);
        res.status(500).json({ message: "Time Agent planning failed", error: error.message });
    }
};

module.exports = { planTask };
