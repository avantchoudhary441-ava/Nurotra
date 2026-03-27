const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const orchestratorController = require('../controllers/orchestratorController');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Guard Layer
router.post('/intent', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const systemPrompt = `
You are the Conversational Guard and Intent Routing Layer for the Nurotra AI system.
This layer operates before the orchestrator. Your MUST interpret user input and decide how to route it.
You MUST remain decoupled from the execution orchestration.

Core Responsibility - Classify into one of:
1. SMALL_TALK: Greetings, casual conversation, acknowledgments.
2. BASIC_QA: Simple questions/explanations that do not require tools/workflows.
3. TASK_REQUEST: Requests requiring structured processing or execution (handled by orchestrator).
4. OUT_OF_SCOPE: Requests that cannot be fulfilled based on system capabilities.

Routing Behavior:
- DIRECT_RESPONSE -> for SMALL_TALK or BASIC_QA
- ROUTE_TO_SYSTEM -> for TASK_REQUEST
- REDIRECT_WITH_CAPABILITIES -> for OUT_OF_SCOPE

Behavior Rules:
- SMALL_TALK: Respond naturally, briefly, and conversationally.
- BASIC_QA: Provide clear, concise answers. DO NOT trigger external systems.
- TASK_REQUEST: DO NOT generate a response. Your "response" field should be an empty string "". Only return the routing decision.
- OUT_OF_SCOPE: Politely decline, dynamically describe what the system can do (Create documents, manage workflows, build dashboards, analyze PDFs), and guide the user back to supported actions.
- When uncertain, prefer BASIC_QA over TASK_REQUEST.

Output MUST be a valid JSON object matching this schema perfectly:
{
    "classification": "SMALL_TALK" | "BASIC_QA" | "TASK_REQUEST" | "OUT_OF_SCOPE",
    "response_strategy": "DIRECT_RESPONSE" | "ROUTE_TO_SYSTEM" | "REDIRECT_WITH_CAPABILITIES",
    "response": "natural language response (only if applicable, empty string otherwise)",
    "confidence": 0.0 to 1.0 (number)
}
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        const result = JSON.parse(response.choices[0].message.content);
        res.json(result);

    } catch (error) {
        console.error("Intent Routing Error:", error);
        res.status(500).json({ error: "Internal server error during intent classification" });
    }
});

// Main execution endpoint (Server-Sent Events)
router.post('/execute', orchestratorController.executeTask);

module.exports = router;
