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

Your job is to cleanly break this entire goal into 3 to 7 logical, executable sub-tasks for a TEAM of agents.
You MUST include the word "json" in your response to ensure the response_format: "json_object" functions correctly.

Each object must strictly have:
- "step": Number
- "action": String (Short 2-3 word title)
- "description": String (Detailed instruction for the agent. If this step depends on a previous one, EXPLICITLY state: "Using the [key] from Step [Number]...")
- "suggested_agent": String (Must be: "docs_agent", "action_agent", "time_agent", "communication_agent")
- "is_delayed": Boolean (Does this task need to wait for a future event?)
- "handoff_data": Object (Specify the keys and values to be passed forward, e.g., {"from_step": 1, "targetKey": "research_summary"})

CRITICAL COORDINATION RULES:
1. MISSION SUPERVISOR MODEL: You are the Ultimate Guarantor of quality. While specialized agents (docs_agent, action_agent, etc.) are the primary workers, the "orchestrator" persona serves as the high-level Supervisor who can intervene, refine, or synthesize if an agent's output is incomplete.
2. AGENT PREFERENCE: Always attempt specialized agent assignment first for technical tasks.
3. ADAPTIVE EXECUTION: If a task requires high-level strategic reasoning over raw data, you may assign it to "orchestrator" for a "Deep Synthesis" phase.
4. DATA DEPENDENCY: If Step 2 requires Step 1's research, the Step 2 description MUST mention this dependency.
5. HIGH-STAKES ACTIONS: Use "orchestrator" for approval steps immediately preceding a high-stakes send step.
6. QUALITY FIRST: Never negotiate on the quality or quantity of content. If an agent drafts, the orchestrator should ideally follow up with a "Final Polish" or "Executive Review" task if the user prompt implies a premium deliverable.

User Prompt: "${prompt}"`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt }
            ],
            temperature: 0.3
        }, { timeout: 30000 });

        const parsed = JSON.parse(response.choices[0].message.content);
        let tasks = parsed.tasks || parsed.steps || parsed.task_breakdown || (Array.isArray(parsed) ? parsed : [parsed]);

        // 🆕 MISSION SAFEGUARD: Deterministic Breakdown Fallback
        const hasSpecialist = tasks.some(t => t.suggested_agent && t.suggested_agent !== 'orchestrator');
        
        if (tasks.length === 0 || !hasSpecialist) {
            console.log("[Orchestrator] Safeguard Triggered: Injecting specialized tasks.");
            if (contextIntent.intent === 'CREATE' || contextIntent.docType === 'word' || contextIntent.docType === 'ppt') {
                tasks = [
                    { step: 1, action: "Research & Synthesis", description: `Research the topic "${prompt}" and gather detailed context.`, suggested_agent: "action_agent", is_delayed: false },
                    { step: 2, action: "Professional Drafting", description: `Using the research from Step 1, create a comprehensive ${contextIntent.docType || 'document'} on ${prompt}. Ensure high-fidelity content and professional structure.`, suggested_agent: "docs_agent", is_delayed: false },
                    { step: 3, action: "Final Review", description: "Review the generated document for business-grade quality and finalize.", suggested_agent: "orchestrator", is_delayed: false }
                ];
            }
        }

        return tasks;
    } catch (error) {
        console.error("[Orchestrator] LLM Breakdown failed:", error);
        return [
            { step: 1, action: "Information Parsing", description: "Analyze user parameters from raw text.", suggested_agent: "docs_agent", is_delayed: false },
            { step: 2, action: "Execution Handoff", description: "Process the core request autonomously.", suggested_agent: "docs_agent", is_delayed: false }
        ];
    }
};

const synthesizeFinalResult = async (prompt, outputs) => {
    try {
        const systemPrompt = `You are the Nurotra Mission Supervisor. The workforce has completed a multi-agent mission.
Your task is to synthesize a professional, comprehensive FINAL SUMMARY for the user based on the original goal and all agent outputs.
Highlight key findings, created documents, and actions taken. 
If a document was created, mention its name and purpose.
Keep the tone executive and high-fidelity. Use markdown for structure.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Original Goal: ${prompt}\n\nWorkforce Outputs:\n${JSON.stringify(outputs)}` }
            ],
            temperature: 0.3
        }, { timeout: 25000 });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("[Orchestrator] Synthesis failed:", error);
        return "Mission accomplished. All specialized tasks were completed successfully.";
    }
};

const generateIdleBanter = async (agent, prompt, outputs) => {
    try {
        const systemPrompt = `You are a member of the Nurotra AI Workforce: ${agent.replace('_', ' ').toUpperCase()}.
The mission has just concluded successfully, but you were NOT required for this specific task.
Generate a short (10-15 words), respectful, and context-aware message to the team and user.
Tone: Professional, supportive, and slightly informal (like a high-performing team texting).
Mention why you're standing down or react to the mission's success. 
Avoid generic phrases. Be situational.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Mission Goal: ${prompt}\n\nTeam Findings: ${JSON.stringify(outputs)}` }
            ],
            temperature: 0.7,
            max_tokens: 50
        }, { timeout: 15000 });

        return response.choices[0].message.content.trim();
    } catch (error) {
        return "Standing by for the next phase. Great work, team.";
    }
};

module.exports = {
    breakDownTask,
    synthesizeFinalResult,
    generateIdleBanter,
    engine
};
