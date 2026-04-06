/**
 * Event Listener Service
 * In-memory event bus that matches incoming events against registered EventRules
 * and fires workflow executions when conditions are met.
 */

const EventRule = require("../models/EventRule");
const ActionWorkflow = require("../models/ActionWorkflow");
const mongoose = require("mongoose");

const DEV_USER_ID = new mongoose.Types.ObjectId("000000000000000000000001");

/**
 * Evaluate a single condition against incoming data
 */
const evaluateCondition = (condition, data) => {
    const { field, operator, value } = condition;
    
    // Get the field value from data (supports nested fields like "message.body")
    const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], data);
    
    switch (operator) {
        case 'contains':
            return String(fieldValue || '').toLowerCase().includes(String(value).toLowerCase());
        case 'equals':
            return String(fieldValue) === String(value);
        case 'not_equals':
            return String(fieldValue) !== String(value);
        case 'gt':
            return Number(fieldValue) > Number(value);
        case 'lt':
            return Number(fieldValue) < Number(value);
        case 'regex':
            try {
                return new RegExp(value, 'i').test(String(fieldValue || ''));
            } catch {
                return false;
            }
        case 'exists':
            return fieldValue !== undefined && fieldValue !== null;
        default:
            return false;
    }
};

/**
 * Evaluate all conditions for a rule against incoming data
 */
const evaluateConditions = (rule, data) => {
    if (!rule.conditions || rule.conditions.length === 0) return true;
    
    const results = rule.conditions.map(cond => evaluateCondition(cond, data));
    
    if (rule.conditionLogic === 'OR') {
        return results.some(r => r === true);
    }
    // Default AND
    return results.every(r => r === true);
};

/**
 * Process an incoming event against all matching rules
 * @param {string} eventType - The event type (webhook, message_received, system_state)
 * @param {object} eventData - The event payload data
 * @param {string} [webhookId] - Optional webhook ID for webhook-type events
 * @returns {Array} - Array of triggered workflow IDs
 */
const processEvent = async (eventType, eventData, webhookId = null) => {
    try {
        // Build query to find matching enabled rules
        const query = { enabled: true, 'trigger.type': eventType };
        if (webhookId) {
            query['trigger.webhookId'] = webhookId;
        }

        const matchingRules = await EventRule.find(query);
        const triggeredWorkflows = [];

        for (const rule of matchingRules) {
            // Evaluate conditions
            const conditionsMet = evaluateConditions(rule, eventData);
            
            if (conditionsMet) {
                // Create and execute a workflow from this rule
                const workflow = await createWorkflowFromRule(rule, eventData);
                if (workflow) {
                    triggeredWorkflows.push(workflow._id);

                    // Update rule execution metadata
                    rule.executionCount += 1;
                    rule.lastTriggered = new Date();
                    await rule.save();
                }
            }
        }

        return triggeredWorkflows;
    } catch (error) {
        console.error("Event Listener - processEvent error:", error);
        return [];
    }
};

/**
 * Create an ActionWorkflow from an EventRule definition
 */
const createWorkflowFromRule = async (rule, eventData) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            console.warn("Event Listener: DB offline, skipping workflow creation.");
            return null;
        }

        const workflow = new ActionWorkflow({
            userId: rule.userId || DEV_USER_ID,
            title: rule.name,
            type: "event_driven",
            status: "running",
            isEventDriven: true,
            eventRuleId: rule._id,
            triggerConfig: {
                type: rule.trigger.type,
                source: rule.trigger.source,
                webhookId: rule.trigger.webhookId
            },
            conditions: rule.conditions,
            conditionLogic: rule.conditionLogic,
            conditionRawText: rule.conditionRawText,
            steps: rule.actions.map(action => ({
                id: action.id,
                label: action.label,
                icon: action.icon || "default",
                status: "pending",
                microLogs: action.microLogs || [],
                delayMs: action.delayMs || 0,
                retryConfig: action.retryConfig || { maxRetries: 1, retryCount: 0, retryDelayMs: 2000 }
            })),
            intentData: {
                trigger: { type: rule.trigger.type, source: rule.trigger.source },
                condition: { raw_text: rule.conditionRawText || "" }
            },
            executionLogs: [{
                status: "info",
                message: `Triggered by ${rule.trigger.type} event`,
                timestamp: new Date(),
                level: "info"
            }]
        });

        await workflow.save();
        return workflow;
    } catch (error) {
        console.error("Event Listener - createWorkflowFromRule error:", error);
        return null;
    }
};

/**
 * Register this service with Socket.io for system_state events
 */
const attachSocketListener = (io) => {
    if (!io) return;

    io.on("connection", (socket) => {
        socket.on("system_event", async (data) => {
            const { eventType, payload } = data || {};
            if (eventType) {
                const triggered = await processEvent(eventType, payload || {});
                if (triggered.length > 0) {
                    socket.emit("workflows_triggered", { workflowIds: triggered });
                }
            }
        });
    });
};

module.exports = {
    processEvent,
    evaluateConditions,
    evaluateCondition,
    createWorkflowFromRule,
    attachSocketListener
};
