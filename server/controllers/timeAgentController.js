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
        // 1. Get current ground truth time
        const temporalContext = getTemporalContext();

        // 1.5 Hardcoded Vagueness Check (Pre-Agent)
        // Only trigger on first turn (history length 1 is just the welcome message)
        const lowerPrompt = prompt.toLowerCase().trim();
        const words = lowerPrompt.split(/\s+/);
        const isVaguePattern = ['report', 'ppt', 'presentation', 'doc', 'document'].some(p => lowerPrompt.includes(p)) && words.length <= 2;

        if (history.length <= 1 && (isVaguePattern || words.length < 2)) {
            const type = lowerPrompt.includes('ppt') || lowerPrompt.includes('presentation') ? 'presentation' : 'report';
            return res.json({
                success: true,
                intent: { is_vague: true, clarification_prompt: `What should the ${type} be about?` },
                planning: null,
                message: `What should the ${type} be about? I need a topic to get started.`
            });
        }

        // 2. Extract Intent (Pass history for multi-turn context)
        const intent = await intentAnalyzer.analyzeIntent(prompt, history, [], temporalContext);
        console.log(`[TimeAgent] Deadline: ${intent.deadline} | Docs Req: ${intent.requires_docs}`);

        // 4. Conversational Check: Handle vague schedules
        if (intent.is_vague || !intent.deadline) {
            return res.json({
                success: true,
                intent,
                planning: null,
                document: null, // NO document during qualification
                message: intent.clarification_prompt || "I need a specific deadline (e.g., 'by 5pm') to generate a detailed schedule for you. When do you need this completed?",
                coordination: {
                    agents: intent.agents || ["time"],
                    status: "waiting_for_input"
                }
            });
        }

        // 4.1 Orchestration: Generate document only after qualification is complete
        let docResult = null;
        if (intent.requires_docs || (intent.agents && intent.agents.includes("docs"))) {
            console.log(`[TimeAgent] Coordination Triggered: Starting Docs Agent for topic: ${intent.topic}`);
            try {
                // Synthesize the prompt to ensure Python microservices receive the full topic context
                // even if the user's current prompt is just a deadline update (e.g., "in 10 sec").
                const synthesizedPrompt = intent.topic
                    ? `Create a ${intent.output_format || 'presentation'} about ${intent.topic}. User's latest instruction: ${prompt}`
                    : prompt;

                docResult = await docsAgentService.generateFullDocument(req.user, {
                    prompt: synthesizedPrompt,
                    history: history
                });
            } catch (docErr) {
                console.warn("[TimeAgent] Docs coordination failed:", docErr.message);
            }
        }

        // 4.5 Fast Track Execution: Skip Planning if deadline is ultra-short (< 2 mins)
        let isFastTrack = false;
        const deadlineStr = String(intent.deadline || "").toLowerCase();
        
        // Match natural language short deadlines which LLM might return literally
        const isShortLiteral = /\b(10|20|30|40|50|60)\s*(sec|s)\b/.test(deadlineStr) || 
                               /\b(1|2)\s*(min|m)\b/.test(deadlineStr);

        if (intent.deadline) {
            const dateVal = new Date(intent.deadline);
            const timeDiff = dateVal.getTime() - Date.now();
            
            if (!isNaN(timeDiff) && timeDiff <= 120000) { // 2 minutes or less
                isFastTrack = true;
            } else if (isShortLiteral) {
                isFastTrack = true;
            }
        }

        if (isFastTrack) {
            console.log(`[TimeAgent] FAST TRACK Triggered: Skipping temporal planning for instant execution.`);
            return res.json({
                success: true,
                intent,
                planning: {
                    intensity: 'critical',
                    totalPhases: 1,
                    schedule: [
                        { timeLabel: "Now", title: "Instant Generation", description: "System has prioritized your request for immediate delivery.", status: "completed", targetDay: new Date().getDate() }
                    ]
                },
                document: docResult ? {
                    id: docResult.document._id,
                    name: docResult.document.name,
                    type: docResult.type,
                    status: 'ready'
                } : null,
                scheduledDocument: null,
                message: docResult
                    ? `Priority hand-off complete. I have skipped the planning phase to deliver your ${docResult.type} instantly. It is ready for download below. \n\n**Evaluation Phase:** Please review the document and let me know if you'd like any adjustments! I can iterate on it right away.`
                    : `I have prioritized your request for instant execution.`,
                coordination: {
                    agents: intent.agents || ["time"],
                    status: docResult ? "Document ready, priority delivered" : "Instant task marked complete"
                }
            });
        }

        // 5. Generate Temporal Schedule
        const planning = await temporalPlanner.generateTimeline(prompt, intent, temporalContext);
        console.log(`[TimeAgent] Schedule Generated: ${planning.totalPhases} phases.`);

        // 6. Return coordinated result to frontend
        res.json({
            success: true,
            intent,
            planning,
            document: null, // Hidden for long tasks until deadline
            scheduledDocument: docResult ? {
                id: docResult.document._id,
                name: docResult.document.name,
                type: docResult.type,
                deliverAt: intent.deadline
            } : null,
            coordination: {
                agents: intent.agents || ["time"],
                status: docResult ? "Document ready, waiting for temporal deadline" : "Standalone temporal plan"
            },
            message: docResult
                ? `I have planned your execution strategy based on the ${intent.deadline || 'requested'} deadline. Your ${docResult.type} will be securely delivered here the moment the deadline arrives. \n\nOnce delivered, I'll be waiting for your **evaluation** to make any necessary changes.`
                : `Time Agent has planned your execution strategy based on the ${intent.deadline || 'requested'} deadline.`,
            userTodos: planning.user_todos || []
        });

    } catch (error) {
        console.error("[TimeAgent] Planning failed:", error);
        res.status(500).json({ message: "Time Agent planning failed", error: error.message });
    }
};

module.exports = { planTask };
