const intentAnalyzer = require("../services/agents/intentAnalyzer");
const temporalPlanner = require("../services/agents/temporalPlanner");
const { getTemporalContext } = require("../utils/timeHelper");

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

        // 2. Extract Intent (Deadline, Urgency, Topic)
        const intent = await intentAnalyzer.analyzeIntent(prompt, "", [], temporalContext);
        console.log(`[TimeAgent] Deadline Extracted: ${intent.deadline || 'None'} | Urgency: ${intent.urgency || 'Medium'}`);

        // 3. Generate Temporal Schedule
        const result = await temporalPlanner.generateTimeline(prompt, intent, temporalContext);
        console.log(`[TimeAgent] Schedule Generated: ${result.totalPhases} phases.`);

        // 4. Return to frontend
        res.json({
            success: true,
            intent,
            planning: result,
            message: `Time Agent has planned your execution strategy based on the ${intent.deadline || 'requested'} deadline.`
        });

    } catch (error) {
        console.error("[TimeAgent] Planning failed:", error);
        res.status(500).json({ message: "Time Agent planning failed", error: error.message });
    }
};

module.exports = { planTask };
