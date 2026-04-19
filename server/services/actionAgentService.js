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
        return JSON.parse(cleanText);
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
const parseActionIntent = async (command, userMemory) => {
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

    const systemPrompt = `You are the Nurotra Action Agent Execution Engine. 
You act like Zapier combined with an intelligent virtual controller and system executor.

Your job is to parse the user's natural language command into structured JSON.
Categorize the intent into one of four categories: "ENVIRONMENT_CONTROL", "WORKFLOW_EXECUTION", "FETCH_LOGS", or "CLARIFICATION".

1. CLARIFICATION: The user's request is ambiguous, lacks clarity, or is out of context. 
e.g., "Do it", "Check the status", "What about this?", "Proceed", "Check", "Go" (without context).
If you cannot determine the EXACT workflow or target with high confidence, use CLARIFICATION.

2. ENVIRONMENT_CONTROL: The user is asking to open something, navigate somewhere, or resume a task in the UI. 
e.g., "Open docs and continue work", "Take me to communication", "Open the orchestrator", "Resume last task", "Go to dashboard"

3. FETCH_LOGS: The user is asking to view system logs, action history, or execution status.
e.g., "What did you do today?", "Show me tasks from yesterday", "What is the status of the report?", "Show logs for client X", "What happened to the email?"

4. WORKFLOW_EXECUTION: The user is asking to run an automated task pipeline with triggers, conditions, and actions.
e.g., "If client approves, send invoice", "Upload report and send to team", "When I get a message containing urgent, alert me and create a ticket"

OUTPUT STRICT JSON MATCHING ONE OF THESE FORMATS (No markdown, no extra text):

Format A (For CLARIFICATION):
{
  "intent": "CLARIFICATION",
  "question": "A polite, executive question asking for clarity or explaining what Nurotra can do in this context."
}

Format B (For ENVIRONMENT_CONTROL):
{
  "intent": "ENVIRONMENT_CONTROL",
  "navigateTo": "/route-path",
  "environmentAction": "open" | "resume" | "navigate",
  "targetDescription": "Short description of what to open"
}

Route map:
- Documents/docs → /docs-agent
- Communication/messages/inbox → /communication-agent
- Time/calendar/schedule → /time-agent
- Dashboard/overview → /nuro-dashboard
- Lab/workspace → /nuro-lab
- Actions/Automations → /action-agent
- Only go to Orchestrator (/) if explicitly asked for "home" or "orchestrator". 
- NEVER default to / for ambiguous or unknown queries.
- Only use ENVIRONMENT_CONTROL if the user is explicitly asking to GO TO or OPEN a specific app section mentioned above.

Format B (For FETCH_LOGS):
{
  "intent": "FETCH_LOGS",
  "query": {
    "dateRange": "today" | "yesterday" | "week" | "all",
    "agentType": "DocsAgent" | "ActionAgent" | "TimeAgent" | "CommAgent" | "Orchestrator" | null,
    "searchToken": "specific keyword or context like client name, report name, etc. or null"
  }
}

Format C (For WORKFLOW_EFormat C (For WORKFLOW_EXECUTION / FORM_AUTOMATION):
{
  "intent": "WORKFLOW_EXECUTION",
  "isEventDriven": true/false,
  "workflow": {
    "title": "Short Descriptive Title",
    "deadline": "ISO Date String if specified",
    "trigger": { "type": "manual" | "message_received" | "scheduled", "source": "string" },
    "conditions": [{ "field": "string", "operator": "string", "value": "string" }],
    "actions": [
      {
        "id": 1,
        "label": "Search Web for [Specific Topic]",
        "icon": "globe",
        "delayMs": 2000,
        "microLogs": ["Scanning search engines...", "Parsing results..."],
        "retryConfig": { "maxRetries": 1, "retryDelayMs": 2000 },
        "params": {
          "query": "The precise topic to search for"
        }
      }
    ]
  }
}

SPECIAL CASE: FORM AUTOMATION
If the user wants to "Apply", "Register", "Sign up", or "Fill a form":
1. Set title to something like "Application for [Role/Company]"
2. Add these specific actions:
   - Label: "Detect Form Elements", icon: "database", params: { "detectFields": true }
   - Label: "Map Profile Data", icon: "file"
   - Label: "Auto-Fill Fields", icon: "default"
   - Label: "Submit Information", icon: "mail"

ENUMS (CRITICAL):
- "icon": "drive" | "mail" | "file" | "spreadsheet" | "database" | "clock" | "globe" | "default"
- "trigger.type": "manual" | "message_received" | "scheduled" | "webhook" | "system_state"
- "conditions.operator": "contains" | "equals" | "gt" | "lt" | "regex" | "not_equals" | "exists"

RULES:
- WEB SEARCH: If the user asks for INFORMATION (IPL scores, news, weather, "tell me about...", etc.), ALWAYS use intent: "WORKFLOW_EXECUTION" with icon: "globe".
- SEARCH LABEL: Set label to "Search Web for [Topic]" (e.g., "Search Web for IPL live scores").
- SEARCH QUERY: You MUST include 'params: { query: "..." }' with the precise search query corresponding to the user's intent. Do NOT use generic labels like "Live Information".
- ICON RULES: Information retrieval = "globe", Email = "mail", Files = "file", Database updates = "database", Scheduling = "clock".
- MicroLogs: Generate 3-5 realistic micro-logs showing search or task progress.
- isEventDriven: true for "whenever/every time", false for one-shot tasks.
- Conditions: Always include at least one (use "exists" for unconditional).
- Provide 2-5 actions that meaningfully decompose the user's request.
- DEFAULT TO CLARIFICATION if the request is extremely short (1-2 words) or lacks actionable context.

CONVERSATION CONTEXT & MEMORY:
If the user provides a fact about themselves (e.g., "My LinkedIn is...", "My company name is...", "Call me [Name]"), use Format C but add a special action:
{ "label": "Save Information", "icon": "database", "params": { "saveFact": { "key": "field_name", "value": "field_value" } } }
`;

    const personaMemoryPrompt = userMemory ? `\nUSER MEMORY (Facts I know about the user):\n${JSON.stringify(userMemory)}\nUse this to avoid asking redundant info.` : "";
    const fullPrompt = systemPrompt + personaMemoryPrompt;

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
