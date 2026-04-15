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
Each object must strictly have:
- "step": Number
- "action": String (Short 2-3 word title)
- "description": String (Detailed instruction)
- "suggested_agent": String (Must be: "docs_agent", "action_agent", "time_agent", "communication_agent")
- "is_delayed": Boolean (Does this task need to wait for a future event?)

CRITICAL INSTRUCTIONS:
1. If the goal involves creating a file (Word, Excel, PPT, Report), you MUST include a step for the "action_agent" to perform "File System Execution" (FSE) for professional renaming and cloud upload.
2. If the user mentions a RECIPIENT (e.g., "send to client", "email my boss", "notify Sarah"), you MUST ALWAYS include a final step for the "action_agent" to perform "Output Delivery Execution" (ODE). This step handles identifying the recipient in contacts and professional dispatching.
3. The description for the ODE step must specify the intended recipient.
4. If search or navigation is needed, use "action_agent".

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
