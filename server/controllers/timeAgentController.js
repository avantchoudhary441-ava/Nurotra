const intentAnalyzer = require("../services/agents/intentAnalyzer");
const temporalPlanner = require("../services/agents/temporalPlanner");
const { getTemporalContext } = require("../utils/timeHelper");

const docsAgentService = require("../services/docsAgentService");

/**
 * Time Agent Planning Endpoint
 * POST /api/time-agent/plan
 */
const planTask = async (req, res) => {
    const { prompt, history = [] } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: "Task prompt is required" });
    }

    try {
        console.log(`[TimeAgent] Analyzing temporal goal: "${prompt}" with ${history.length} messages in history`);

        // 1. Get current ground truth time
        const temporalContext = getTemporalContext();

        // 2. Extract Intent (Pass history for multi-turn context)
        const intent = await intentAnalyzer.analyzeIntent(prompt, history, [], temporalContext);
        console.log(`[TimeAgent] Deadline: ${intent.deadline} | Docs Req: ${intent.requires_docs}`);

        // 3. Coordination Logic (Can start even if schedule is vague)
        let docResult = null;
        if (intent.requires_docs || (intent.agents && intent.agents.includes("docs"))) {
            console.log(`[TimeAgent] Coordination Triggered: Starting Docs Agent in background...`);
            try {
                // We generate the doc immediately to buy the user time
                docResult = await docsAgentService.generateFullDocument(req.user, { prompt });
            } catch (docErr) {
                console.warn("[TimeAgent] Docs coordination failed:", docErr.message);
            }
        }

        // 4. Conversational Check: Handle vague schedules
        if (intent.is_vague || !intent.deadline) {
            return res.json({
                success: true,
                intent,
                planning: null,
                document: docResult ? {
                    id: docResult.document._id,
                    name: docResult.document.name,
                    type: docResult.type,
                    status: 'ready'
                } : null,
                message: intent.clarification_prompt || (docResult
                    ? `I've started generating your ${docResult.type}, but I need a specific deadline (e.g., 'by 5pm') to create a schedule for you. When do you need this finished?`
                    : "I need a specific deadline (e.g., 'by 5pm') to generate a detailed schedule for you. When do you need this completed?"),
                coordination: {
                    agents: intent.agents || ["time"],
                    status: docResult ? "Document ready, waiting for temporal context" : "waiting_for_input"
                }
            });
        }

        // 5. Generate Temporal Schedule
        const planning = await temporalPlanner.generateTimeline(prompt, intent, temporalContext);
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
