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

Format B (For WORKFLOW_EXECUTION):
{
  "intent": "WORKFLOW_EXECUTION",
  "isEventDriven": true/false,
  "workflow": {
    "title": "Short Descriptive Title",
    "deadline": "ISO Date String if specified, e.g., 'by 5 PM today'",
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
        "isReversible": true/false,
        "delayMs": 2000,
        "microLogs": ["Preparing template...", "Assigning amount...", "Generated."],
        "retryConfig": { "maxRetries": 1, "retryDelayMs": 2000 },
        "missingData": [
          { 
            "field": "recipient_id", 
            "criticality": "critical" | "minor",
            "inferredValue": "Suggested value or null"
          }
        ]
      }
    ]
  }
}

RULES:
- "isReversible": Set to FALSE if the action sends an external message (email/slack), deletes data, or commits a non-undoable transaction. TRUE for data fetching, generation, or internal logs.
- "deadline": Look for "by [time]", "within [duration]", "deadline is [time]".
- "missingData": Identify any required parameters not found in the prompt. Identify if ID, names or specific values are missing.
- "icon" must be one of: drive, mail, file, spreadsheet, database, clock, default
- If the command implies repeatable automation (e.g. "whenever", "every time"), set isEventDriven: true
- Always include at least one condition object (use operator: "exists" for unconditional)
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

module.exports = {
    parseActionIntent,
    parseEventRuleIntent
};
