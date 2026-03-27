const OpenAI = require('openai');
const engine = require('./intentEngine');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Dynamically break down tasks using LLM based on the user's intent.
 */
const breakDownTask = async (prompt, contextIntent) => {
    try {
        const systemPrompt = `You are the Nurotra Orchestrator Task Engine. 
The user has provided a prompt, and the internal engine classified the primary intent as: ${contextIntent.intent} with content type: ${contextIntent.docType}.
Your job is to cleanly break this entire goal into 3 to 5 logical, executable sub-tasks.
Provide a JSON array of task objects.
Each object must strictly have:
- "step": Number
- "action": String (Short 2-3 word title)
- "description": String (Detailed instruction outlining exactly what to do)
- "suggested_agent": String (Must precisely be one of: "docs_agent", "time_agent", "communication_agent", "collaborator_agent")
- "is_delayed": Boolean (Does this task specifically need to wait for a future time event before executing?)

User Prompt: "${prompt}"`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt }
            ],
            temperature: 0.4
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        // Safely extract the array using fallback keys
        return parsed.tasks || parsed.steps || parsed.task_breakdown || [parsed];
    } catch (error) {
        console.error("[Orchestrator] LLM Breakdown failed:", error);
        // Deterministic Fallback if LLM times out or API key missing
        return [
            { step: 1, action: "Information Parsing", description: "Analyze user parameters from raw text.", suggested_agent: "docs_agent", is_delayed: false },
            { step: 2, action: "Execution Handoff", description: "Process the core request autonomously.", suggested_agent: "docs_agent", is_delayed: false }
        ];
    }
};

module.exports = {
    breakDownTask,
    engine
};
