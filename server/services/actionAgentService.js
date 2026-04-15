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
const parseActionIntent = async (command) => {
    const systemPrompt = `You are the Nurotra Action Agent Execution Engine. 
You act like Zapier combined with an intelligent virtual controller and system executor.

Your job is to parse the user's natural language command into structured JSON.
Categorize the intent into one of three categories: "ENVIRONMENT_CONTROL", "WORKFLOW_EXECUTION", or "FETCH_LOGS".

1. ENVIRONMENT_CONTROL: The user is asking to open something, navigate somewhere, or resume a task in the UI. 
e.g., "Open docs and continue work", "Take me to communication", "Open the orchestrator", "Resume last task", "Go to dashboard"

2. FETCH_LOGS: The user is asking to view system logs, action history, or execution status.
e.g., "What did you do today?", "Show me tasks from yesterday", "What is the status of the report?", "Show logs for client X", "What happened to the email?"

3. WORKFLOW_EXECUTION: The user is asking to run an automated task pipeline with triggers, conditions, and actions.
e.g., "If client approves, send invoice", "Upload report and send to team", "When I get a message containing urgent, alert me and create a ticket"

OUTPUT STRICT JSON MATCHING ONE OF THESE FORMATS (No markdown, no extra text):

Format A (For ENVIRONMENT_CONTROL):
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

Format C (For WORKFLOW_EXECUTION):
{
  "intent": "WORKFLOW_EXECUTION",
  "isEventDriven": true/false,
  "workflow": {
    "title": "Short Descriptive Title",
    "trigger": {
      "type": "message_received" | "manual" | "scheduled" | "webhook" | "system_state",
      "source": "Description of trigger source"
    },
    "conditions": [
      {
        "field": "message.body",
        "operator": "contains" | "equals" | "gt" | "lt" | "regex" | "not_equals" | "exists",
        "value": "the value to check",
        "raw_text": "Human readable condition text"
      }
    ],
    "conditionLogic": "AND" | "OR",
    "conditionRawText": "Full human readable condition summary",
    "actions": [
      {
        "id": 1,
        "label": "Generate Invoice",
        "icon": "file",
        "delayMs": 2000,
        "microLogs": ["Preparing template...", "Assigning amount...", "Generated."],
        "retryConfig": {
          "maxRetries": 1,
          "retryDelayMs": 2000
        },
        "params": {
          "query": "The actual topic to search or act upon"
        }
      }
    ]
  }
}

RULES:
- MANDATORY SEARCH: If the user asks for INFORMATION from the web (IPL scores, match status, weather, flight status, current news, "tell me..."), ALWAYS use intent: "WORKFLOW_EXECUTION" with icon: "globe" and label: "Search Web for Live Information".
- FORBIDDEN: NEVER use a "database" icon or "Update Status" label for informational retrieval or search-related questions.
- DEFAULT TO WORKFLOW_EXECUTION: If user intent is a question or seeks info, ALWAYS choose "WORKFLOW_EXECUTION".
- NO TRIVIAL NAVIGATION: Never return "ENVIRONMENT_CONTROL" with "/" unless the user says "Go home".
- ICON RULES: Information retrieval = "globe", Email = "mail", Files = "drive", Calendar = "clock".
- MicroLogs: Generate 3-5 realistic micro-logs showing search progress (e.g., "Scanning sports engines...", "Checking live scoreboards...", "Parsing match results...").
- Search Task: For search requests, generate an action with label "Search Web for [Topic]".
- Search Query: If the task is a web search, the action MUST include the 'params: { query: "User\\'s specific search topic" }' with the precise thing to search for (e.g. "IPL live scores").
- isEventDriven: true for "whenever/every time", false for one-shot tasks.
- Conditions: Always include at least one (use "exists" for unconditional).
`;

    const responseText = await aiService.generateWithFallback(command, systemPrompt);
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
      "icon": "file",
      "delayMs": 2000,
      "microLogs": ["Step 1...", "Step 2...", "Done."],
      "retryConfig": {
        "maxRetries": 1,
        "retryDelayMs": 2000
      }
    }
  ]
}

RULES:
- "icon" must be one of: drive, mail, file, spreadsheet, database, clock, default
- Always include at least one condition
- Generate realistic microLogs (2-3 per action)
- Provide 2-5 meaningful actions
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
    
    RULES:
    1. SUGGESTIONS MUST BE EXECUTABLE: Only suggest tasks related to Searching, Emailing, Reporting, Analytics, or Navigation.
    2. CONTEXT AWARE: Focus on current high-value tasks like research, scheduling, or reporting.
    3. FORMAT: Return strictly a JSON array of 3-4 strings. No markdown.
    
    EXAMPLE: ["Search for latest AI news", "Generate a weekly recap report", "Notify team about project status"]`;

    const prompt = `User Context: ${JSON.stringify(userContext)}. Suggest actionable automations.`;
    
    try {
        const responseText = await aiService.generateWithFallback(prompt, systemPrompt, [], [], { forceJson: true });
        return parseJSON(responseText);
    } catch (e) {
        return [
            "Search for current market trends",
            "Generate a performance report",
            "Send a project update email"
        ];
    }
};

module.exports = {
    parseActionIntent,
    parseEventRuleIntent,
    getDynamicSuggestions
};
