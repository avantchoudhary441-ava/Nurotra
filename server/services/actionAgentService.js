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
Categorize the intent into one of two categories: "ENVIRONMENT_CONTROL" or "WORKFLOW_EXECUTION".

1. ENVIRONMENT_CONTROL: The user is asking to open something, navigate somewhere, or resume a task in the UI. 
e.g., "Open docs and continue work", "Take me to communication", "Open the orchestrator", "Resume last task", "Go to dashboard"

2. WORKFLOW_EXECUTION: The user is asking to run an automated task pipeline with triggers, conditions, and actions.
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
- Orchestrator/home → /
- Action agent/automations → /action-agent
- If ambiguous → /

Format B (For WORKFLOW_EXECUTION / FORM_AUTOMATION):
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
        "label": "Action label",
        "icon": "mail" | "file" | "database" | "clock" | "default",
        "params": { 
           "formUrl": "string if applicable",
           "detectFields": true/false 
        },
        "microLogs": ["Step 1...", "Step 2..."]
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
- "icon": "drive" | "mail" | "file" | "spreadsheet" | "database" | "clock" | "default"
- "trigger.type": "manual" | "message_received" | "scheduled" | "webhook" | "system_state"
- "conditions.operator": "contains" | "equals" | "gt" | "lt" | "regex" | "not_equals" | "exists"

RULES:
- If the command implies repeatable automation, set isEventDriven: true
- Provide 2-5 actions that meaningfully decompose the user's request
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

module.exports = {
    parseActionIntent,
    parseEventRuleIntent
};
