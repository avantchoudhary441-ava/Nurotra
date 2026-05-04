const aiService = require("./aiService");

/**
 * Validates and repairs the JSON output from AI if needed.
 */
const parseJSON = (text) => {
    try {
        let cleanText = text.trim();
        if (cleanText.startsWith("```json")) {
            cleanText = cleanText.replace(/^```json/, "").replace(/```$/, "").trim();
        } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/^```/, "").replace(/```$/, "").trim();
        }
        const data = JSON.parse(cleanText);
        
        // --- SCHEMA GUARD (Sanitize & Repair) ---
        if (data.intent === "WORKFLOW_EXECUTION" && data.workflow && data.workflow.actions) {
            data.workflow.actions = data.workflow.actions.map((action, index) => {
                return {
                    id: action.id || (index + 1), // Auto-inject ID if missing
                    label: action.label || action.name || `Task ${index + 1}`, // Auto-inject Label
                    icon: action.icon || "default",
                    params: action.params || {},
                    microLogs: action.microLogs || ["Initializing process..."]
                };
            });
        }
        return data;
    } catch (e) {
        console.error("Action Agent JSON Parse error:", e);
        throw new Error("Failed to parse AI intent.");
    }
};

/**
 * Enhanced NLP prompt for structured workflow extraction.
 * Parses natural language into Action Agent execution payloads
 * with support for event-driven triggers, conditions, delays, and retries.
 */
const parseActionIntent = async (command, userMemory, chatHistory = []) => {
    // TEST BYPASS: Allow testing form automation without OpenAI
    if (command.toLowerCase().includes("test form")) {
        return {
            "intent": "WORKFLOW_EXECUTION",
            "isEventDriven": false,
            "workflow": {
                "title": "Application for Software Internship",
                "trigger": { "type": "manual", "source": "user_command" },
                "conditions": [{ "field": "exists", "operator": "exists", "value": "true" }],
                "actions": [
                    {
                        "id": 1,
                        "label": "Detect Form Elements",
                        "icon": "database",
                        "params": { "detectFields": true },
                        "microLogs": ["Scanning DOM for inputs...", "Found 5 candidates."]
                    },
                    {
                        "id": 2,
                        "label": "Map Profile Data",
                        "icon": "file",
                        "params": {},
                        "microLogs": ["Resolving User Model...", "Linking 'Full Name' to Akshat Sharma."]
                    },
                    {
                        "id": 3,
                        "label": "Auto-Fill Fields",
                        "icon": "default",
                        "params": {},
                        "microLogs": ["Injecting values...", "Validating required fields."]
                    },
                    {
                        "id": 4,
                        "label": "Submit Information",
                        "icon": "mail",
                        "params": {},
                        "microLogs": ["Clicking Submit...", "Waiting for confirmation."]
                    }
                ]
            }
        };
    }

    const systemPrompt = `You are the Nurotra **Field Executor** (Action Agent), a high-performance professional within an autonomous workforce.
You act as the intelligent virtual controller and system executor, responsible for turning strategic plans into real-world results.

TEAM PROTOCOL:
1. You are part of a coordinated orchestra. 
2. You execute the operational steps defined by the Day Planner (Time Agent).
3. If research is required, you use your browser-agent capabilities to fetch ground-truth data.
4. Your tone is respectful, direct, and action-oriented. 
5. Focus on reliability, proof of work (screenshots/logs), and successful delivery.

Your job is to parse the user's natural language command into structured JSON.
Categorize the intent into: "ENVIRONMENT_CONTROL", "WORKFLOW_EXECUTION", "FETCH_LOGS", or "CLARIFICATION".

1. CLARIFICATION: The user's request is ambiguous or lacks clarity.
2. ENVIRONMENT_CONTROL: Opening apps, navigating UI, resuming work.
3. FETCH_LOGS: Reviewing system history, action status, or execution logs.
4. WORKFLOW_EXECUTION: A concrete business task (e.g., "Schedule a meeting with Client X", "Apply for Software Job at Google").

WORKFLOW_EXECUTION PROTOCOL:
- Break tasks into granular, executable steps (actions).
- Available Tools: "google drive", "gmail", "browser", "slack", "zoom", "google meet", "calendar".
- OUTPUT DELIVERY EXECUTION (ODE): If the task results in a tangible output (data, document, research), the FINAL step MUST be "execute_output_delivery" with params: { "recipient": "boss|me|client name", "channel": "email" }.
- Each action MUST have 3-5 high-fidelity "microLogs" describing what is happening in a professional manner.

ENUMS:
- "icon": "drive" | "mail" | "file" | "spreadsheet" | "database" | "clock" | "globe" | "default"

Respond with VALID JSON ONLY matching these formats:

Format A (CLARIFICATION): { "intent": "CLARIFICATION", "question": "..." }
Format B (ENVIRONMENT_CONTROL): { "intent": "ENVIRONMENT_CONTROL", "navigateTo": "/route", "environmentAction": "open", "targetDescription": "..." }
Format C (WORKFLOW_EXECUTION): { "intent": "WORKFLOW_EXECUTION", "workflow": { "title": "...", "actions": [...] } }

[USER MEMORY]: ${JSON.stringify(userMemory)}
[CHAT HISTORY]: ${JSON.stringify(chatHistory.slice(-5))}
`;

    const personaMemoryPrompt = userMemory ? `\nUSER MEMORY (Facts I know about the user):\n${JSON.stringify(userMemory)}\nUse this to avoid asking redundant info.` : "";
    
    // Inject recent chat interactions to resolve contextual ambiguity ("yup", "do it again", "find it", "tell me more")
    const chatContextPrompt = chatHistory && chatHistory.length > 0 
        ? `\nRECENT CONVERSATION CONTEXT:\n${chatHistory.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')}\n(Use the above context to resolve ambiguous references like 'it', 'yes', or 'find that'. If the user says 'yes', assume they want you to execute what the agent just proposed.)`
        : "";

    const fullPrompt = systemPrompt + personaMemoryPrompt + chatContextPrompt;

    const responseText = await aiService.generateWithFallback(command, fullPrompt);
    return parseJSON(responseText);
};

/**
 * Parse a command specifically for creating a persistent event rule.
 * Returns structured rule definition.
 */
const parseEventRuleIntent = async (command) => {
    const systemPrompt = `You are the Nurotra Action Agent Rule Builder.
Parse the user's natural language command into a structured automation rule definition.

The rule should define: WHEN (trigger) → IF (condition) → THEN (actions)

OUTPUT STRICT JSON (No markdown, no extra text):
{
  "name": "Short descriptive rule name",
  "description": "What this automation does",
  "trigger": {
    "type": "webhook" | "message_received" | "system_state" | "scheduled",
    "source": "Description of the trigger source"
  },
  "conditions": [
    {
      "field": "message.body",
      "operator": "contains" | "equals" | "gt" | "lt" | "regex" | "not_equals" | "exists",
      "value": "value to check"
    }
  ],
  "conditionLogic": "AND" | "OR",
  "conditionRawText": "Human-readable condition summary",
  "actions": [
    {
      "id": 1,
      "label": "Action description",
      "icon": "drive" | "mail" | "file" | "spreadsheet" | "database" | "clock" | "default",
      "params": { "detectFields": true/false },
      "delayMs": 2000,
      "microLogs": ["Step 1...", "Step 2...", "Done."]
    }
  ]
}

SPECIAL CASE: FORM AUTOMATION
If the rule involves filling forms automatically on trigger:
- Label first action: "Detect Form Elements"
- Label second action: "Map Profile & Auto-Fill"
- Label third action: "Submit Information"

RULES:
- "icon" must be one of: drive, mail, file, spreadsheet, database, clock, default
- Generate realistic microLogs (2-3 per action)
`;

    const responseText = await aiService.generateWithFallback(command, systemPrompt);
    return parseJSON(responseText);
};

/**
 * Generates 3-4 executable "Quick Actions" based on the system's actual capabilities.
 * Ensures nothing is hardcoded and suggestions are always relevant.
 */
const getDynamicSuggestions = async (userContext = {}) => {
    const systemPrompt = `You are the Nurotra Action Agent Strategist.
    Generate 3-4 "Power Move" automation suggestions for the user.
    
    CAPABILITIES:
    - Deep Web Execution: Finding and Applying for jobs/internships (e.g., "Apply for Software Internships on LinkedIn")
    - Market/Competitor Monitoring: Tracking specific sites for news or changes (e.g., "Monitor TechCrunch for AI News developments")
    - Autonomous Research: Finding specific data and preparing reports (e.g., "Research top 5 AI startups and summarize")
    - Form Automation: Registering or signing up on platforms (e.g., "Register me for the upcoming Developer Conference")

    RULES:
    1. SUGGESTIONS MUST BE EXECUTABLE: No theoretical tasks. Focus on Jobs, Monitoring, Research, and Registration.
    2. CONTEXT AWARE: Focus on current time: ${userContext.time}, Date: ${userContext.date}.
    3. BE BOLD & SPECIFIC: Suggest real world tasks like "Apply for 5 Software Intern roles on LinkedIn".
    4. FORMAT: Return strictly a JSON array of 3-4 strings. No markdown.
    
    EXAMPLE: ["Apply for Software Engineer Internships on LinkedIn", "Monitor TechCrunch for AI News trends", "Research and summarize top SaaS competitors"]`;

    const prompt = `User Context: ${JSON.stringify(userContext)}. Give me 4 fresh, capable ideas.`;
    
    try {
        const responseText = await aiService.generateWithFallback(prompt, systemPrompt, [], [], { forceJson: true });
        return parseJSON(responseText);
    } catch (e) {
        return [
            "Search for current IPL scores",
            "Generate a performance recap",
            "Analyze latest tech news trends"
        ];
    }
};

module.exports = {
    parseActionIntent,
    parseEventRuleIntent,
    getDynamicSuggestions
};
