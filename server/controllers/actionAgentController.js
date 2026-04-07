const mongoose = require("mongoose");
const actionAgentService = require("../services/actionAgentService");
const eventListenerService = require("../services/eventListenerService");
const ActionWorkflow = require("../models/ActionWorkflow");
const EventRule = require("../models/EventRule");

const DEV_USER_ID = new mongoose.Types.ObjectId("000000000000000000000001");

// ===========================================
// EXECUTE COMMAND (Enhanced)
// ===========================================
exports.executeCommand = async (req, res) => {
    try {
        const { command } = req.body;
        if (!command) {
            return res.status(400).json({ success: false, message: "Command is required." });
        }

        // 1. Analyze Intent using NLP
        const parsedData = await actionAgentService.parseActionIntent(command);

        if (parsedData.intent === "ENVIRONMENT_CONTROL") {
            return res.json({
                success: true,
                intent: "ENVIRONMENT_CONTROL",
                navigateTo: parsedData.navigateTo,
                environmentAction: parsedData.environmentAction || "navigate",
                targetDescription: parsedData.targetDescription || ""
            });
        }

        if (parsedData.intent === "WORKFLOW_EXECUTION") {
            const workflowData = parsedData.workflow;
            const isEventDriven = parsedData.isEventDriven || false;

            // If DB is offline, return mock workflow
            if (mongoose.connection.readyState !== 1) {
                const mockWorkflow = buildMockWorkflow(workflowData, isEventDriven);
                return res.json({
                    success: true,
                    intent: "WORKFLOW_EXECUTION",
                    workflow: mockWorkflow,
                    dbOffline: true,
                    isEventDriven
                });
            }

            // If event-driven, create a persistent EventRule instead of immediate execution
            if (isEventDriven) {
                const rule = new EventRule({
                    userId: req.user ? req.user._id : DEV_USER_ID,
                    name: workflowData.title || "Automated Rule",
                    description: workflowData.conditionRawText || "",
                    trigger: {
                        type: workflowData.trigger?.type || "message_received",
                        source: workflowData.trigger?.source || ""
                    },
                    conditions: (workflowData.conditions || []).map(c => ({
                        field: c.field,
                        operator: c.operator,
                        value: c.value
                    })),
                    conditionLogic: workflowData.conditionLogic || "AND",
                    conditionRawText: workflowData.conditionRawText || "",
                    actions: workflowData.actions.map(action => ({
                        id: action.id,
                        label: action.label,
                        icon: action.icon || "default",
                        delayMs: action.delayMs || 2000,
                        microLogs: action.microLogs || [],
                        retryConfig: action.retryConfig || { maxRetries: 1, retryDelayMs: 2000 }
                    }))
                });

                await rule.save();

                return res.json({
                    success: true,
                    intent: "WORKFLOW_EXECUTION",
                    isEventDriven: true,
                    eventRule: rule,
                    message: `Automation rule "${rule.name}" created. It will fire when the trigger conditions are met.`
                });
            }

            // 2. Build the workflow DB entry for immediate execution
            const deadlineDate = workflowData.deadline ? new Date(workflowData.deadline) : null;
            const now = Date.now();
            let autoAcceptAt = null;
            
            // Check if any action is irreversible
            const hasIrreversible = workflowData.actions.some(a => a.isReversible === false);
            
            if (hasIrreversible) {
                let waitMs = 15 * 60 * 1000; // 15 mins default
                if (deadlineDate && !isNaN(deadlineDate.getTime())) {
                    const timeToDeadline = deadlineDate.getTime() - now;
                    if (timeToDeadline > 0) {
                        waitMs = Math.min(waitMs, timeToDeadline / 2);
                    }
                }
                autoAcceptAt = new Date(now + waitMs);
            }

            const newWorkflow = new ActionWorkflow({
                userId: req.user ? req.user._id : DEV_USER_ID,
                title: workflowData.title || "Automated Task",
                type: "active",
                status: "running",
                deadline: deadlineDate,
                autoAcceptAt: autoAcceptAt,
                confirmationStatus: hasIrreversible ? "pending" : "none",
                triggerConfig: {
                    type: workflowData.trigger?.type || "manual",
                    source: workflowData.trigger?.source || "user_command"
                },
                conditions: (workflowData.conditions || []).map(c => ({
                    field: c.field,
                    operator: c.operator,
                    value: c.value,
                    raw_text: c.raw_text || ""
                })),
                conditionLogic: workflowData.conditionLogic || "AND",
                conditionRawText: workflowData.conditionRawText || "",
                steps: workflowData.actions.map(action => {
                    // Strict parsing for irreversibility (handle strings or booleans)
                    let isRev = true;
                    if (action.isReversible === false || action.isReversible === 'false') {
                        isRev = false;
                    }

                    return {
                        id: action.id,
                        label: action.label,
                        icon: action.icon || "default",
                        status: "pending",
                        microLogs: action.microLogs || [],
                        delayMs: action.delayMs || 0,
                        retryConfig: action.retryConfig || { maxRetries: 0, retryCount: 0, retryDelayMs: 2000 },
                        requiresIntervention: false,
                        isBulk: false,
                        isReversible: isRev,
                        missingData: action.missingData || []
                    };
                }),
                intentData: {
                    trigger: workflowData.trigger,
                    condition: { raw_text: workflowData.conditionRawText || "" },
                    conditions: workflowData.conditions
                },
                executionLogs: [{
                    status: "info",
                    message: `Workflow initiated: "${workflowData.title}"`,
                    timestamp: new Date(),
                    level: "info"
                }]
            });

            await newWorkflow.save();

            // 3. Kick off async execution (background)
            simulateExecution(newWorkflow._id, workflowData.actions);

            return res.json({
                success: true,
                intent: "WORKFLOW_EXECUTION",
                workflow: newWorkflow,
                isEventDriven: false
            });
        }

        return res.status(400).json({ success: false, message: "Unknown intent parsed." });

    } catch (error) {
        console.error("Action Agent Execute Controller Error:", error);
        res.status(500).json({ success: false, message: "Server error during execution." });
    }
};

// ===========================================
// CREATE EVENT RULE
// ===========================================
exports.createEventRule = async (req, res) => {
    try {
        const { command, ruleData } = req.body;

        let parsedRule;
        if (command) {
            // NLP-based rule creation
            parsedRule = await actionAgentService.parseEventRuleIntent(command);
        } else if (ruleData) {
            // Direct structured rule creation
            parsedRule = ruleData;
        } else {
            return res.status(400).json({ success: false, message: "Either 'command' or 'ruleData' is required." });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.json({
                success: true,
                eventRule: { ...parsedRule, _id: 'mock_rule_' + Date.now() },
                dbOffline: true
            });
        }

        const rule = new EventRule({
            userId: req.user ? req.user._id : DEV_USER_ID,
            name: parsedRule.name || "Custom Rule",
            description: parsedRule.description || "",
            trigger: {
                type: parsedRule.trigger?.type || "message_received",
                source: parsedRule.trigger?.source || ""
            },
            conditions: parsedRule.conditions || [],
            conditionLogic: parsedRule.conditionLogic || "AND",
            conditionRawText: parsedRule.conditionRawText || "",
            actions: parsedRule.actions || []
        });

        await rule.save();

        res.json({ success: true, eventRule: rule });
    } catch (error) {
        console.error("Create Event Rule Error:", error);
        res.status(500).json({ success: false, message: "Failed to create event rule." });
    }
};

// ===========================================
// GET EVENT RULES
// ===========================================
exports.getEventRules = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, rules: [], dbOffline: true });
        }

        const query = req.user ? { userId: req.user._id } : {};
        const rules = await EventRule.find(query).sort({ createdAt: -1 });
        res.json({ success: true, rules });
    } catch (error) {
        console.error("Get Event Rules Error:", error);
        res.json({ success: true, rules: [], error: error.message });
    }
};

// ===========================================
// DELETE EVENT RULE
// ===========================================
exports.deleteEventRule = async (req, res) => {
    try {
        const { id } = req.params;
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, dbOffline: true });
        }

        await EventRule.findByIdAndDelete(id);
        res.json({ success: true, message: "Rule deleted." });
    } catch (error) {
        console.error("Delete Event Rule Error:", error);
        res.status(500).json({ success: false, message: "Failed to delete rule." });
    }
};

// ===========================================
// TOGGLE EVENT RULE
// ===========================================
exports.toggleEventRule = async (req, res) => {
    try {
        const { id } = req.params;
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, dbOffline: true });
        }

        const rule = await EventRule.findById(id);
        if (!rule) return res.status(404).json({ success: false, message: "Rule not found." });

        rule.enabled = !rule.enabled;
        await rule.save();

        res.json({ success: true, eventRule: rule });
    } catch (error) {
        console.error("Toggle Event Rule Error:", error);
        res.status(500).json({ success: false, message: "Failed to toggle rule." });
    }
};

// ===========================================
// WEBHOOK TRIGGER
// ===========================================
exports.triggerWebhook = async (req, res) => {
    try {
        const { webhookId } = req.params;
        const payload = req.body;

        const triggeredWorkflows = await eventListenerService.processEvent("webhook", payload, webhookId);

        res.json({
            success: true,
            message: `Webhook processed. ${triggeredWorkflows.length} workflow(s) triggered.`,
            workflowIds: triggeredWorkflows
        });
    } catch (error) {
        console.error("Webhook Trigger Error:", error);
        res.status(500).json({ success: false, message: "Webhook processing failed." });
    }
};

// ===========================================
// GET WORKFLOW LOGS
// ===========================================
exports.getWorkflowLogs = async (req, res) => {
    try {
        const { workflowId } = req.params;
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, logs: [], dbOffline: true });
        }

        const workflow = await ActionWorkflow.findById(workflowId);
        if (!workflow) return res.status(404).json({ success: false, message: "Workflow not found." });

        res.json({ success: true, logs: workflow.executionLogs || [] });
    } catch (error) {
        console.error("Get Workflow Logs Error:", error);
        res.json({ success: true, logs: [], error: error.message });
    }
};

// ===========================================
// CONFIRM WORKFLOW (Manual Override)
// ===========================================
exports.confirmWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const wf = await ActionWorkflow.findById(id);
        if (!wf) return res.status(404).json({ success: false, message: "Workflow not found." });

        wf.confirmationStatus = "confirmed";
        wf.status = "running";
        wf.activeMicroLog = "User confirmed. Resuming execution...";
        await wf.save();

        res.json({ success: true, message: "Workflow confirmed. Execution will resume shortly." });
    } catch (error) {
        console.error("Confirm Workflow Error:", error);
        res.status(500).json({ success: false, message: "Failed to confirm workflow." });
    }
};

// ===========================================
// SUBMIT INTERVENTION (Missing Data)
// ===========================================
exports.submitIntervention = async (req, res) => {
    try {
        const { id } = req.params;
        const { field, value } = req.body;
        
        const wf = await ActionWorkflow.findById(id);
        if (!wf) return res.status(404).json({ success: false, message: "Workflow not found." });

        // Update the blocked step with the new data
        const stepIndex = wf.steps.findIndex(s => s.status === 'intervention');
        if (stepIndex !== -1) {
            const step = wf.steps[stepIndex];
            
            // Find the missing data entry and update it
            const mIndex = step.missingData.findIndex(m => m.field === field);
            if (mIndex !== -1) {
                step.missingData[mIndex].inferredValue = value;
            } else {
                step.missingData.push({ field, inferredValue: value, criticality: 'critical' });
            }
            
            wf.steps[stepIndex].status = "pending";
            wf.steps[stepIndex].interventionMsg = null;
        }

        wf.status = "running";
        wf.activeMicroLog = "Input received. Resuming execution...";
        addLog(wf, null, null, "info", `User provided missing data for field: ${field}`);
        await wf.save();

        // Resume async execution if it stopped (it did since simulateExecution returned on intervention)
        simulateExecution(wf._id, null); // actionDefs are already in the DB steps now or we can look them up

        res.json({ success: true, message: "Intervention resolved. Execution resumed." });
    } catch (error) {
        console.error("Submit Intervention Error:", error);
        res.status(500).json({ success: false, message: "Failed to resolve intervention." });
    }
};

// ===========================================
// FETCH ACTIVE TASKS
// ===========================================
exports.getActiveTasks = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, tasks: [], dbOffline: true });
        }
        const query = req.user
            ? { 
                userId: req.user._id, 
                $or: [
                    { status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] } },
                    { status: "completed", isAcknowledged: false }
                ]
              }
            : { 
                $or: [
                    { status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] } },
                    { status: "completed", isAcknowledged: false }
                ]
              };

        const tasks = await ActionWorkflow.find(query).sort({ startTime: -1 });
        res.json({ success: true, tasks });
    } catch (err) {
        console.error("Action Agent Fetch Tasks Error:", err.message);
        res.json({ success: true, tasks: [], error: err.message });
    }
};

// ===========================================
// ACKNOWLEDGE & DISMISS TASK
// ===========================================
exports.acknowledgeTask = async (req, res) => {
    try {
        const { workflowId } = req.params;
        const wf = await ActionWorkflow.findById(workflowId);
        if (!wf) return res.status(404).json({ success: false, message: "Task not found." });

        wf.isAcknowledged = true;
        await wf.save();

        res.json({ success: true, message: "Task dismissed to history." });
    } catch (err) {
        console.error("Acknowledge Task Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ===========================================
// FETCH HISTORY
// ===========================================
exports.getHistory = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, tasks: [], dbOffline: true });
        }
        const query = req.user
            ? { userId: req.user._id, status: { $in: ["completed", "failed"] } }
            : { status: { $in: ["completed", "failed"] } };

        const tasks = await ActionWorkflow.find(query).sort({ startTime: -1 }).limit(20);
        res.json({ success: true, tasks });
    } catch (err) {
        console.error("Action Agent Fetch History Error:", err.message);
        res.json({ success: true, tasks: [], error: err.message });
    }
};


// ===========================================
// HELPERS
// ===========================================

/**
 * Build a mock workflow for DB-offline mode
 */
const buildMockWorkflow = (workflowData, isEventDriven) => ({
    _id: 'mock_' + Date.now(),
    title: workflowData.title || "Automated Task (MOCK DB OFFLINE)",
    type: isEventDriven ? "event_driven" : "active",
    status: "running",
    isEventDriven,
    steps: workflowData.actions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon || "default",
        status: "pending",
        microLogs: action.microLogs || [],
        delayMs: action.delayMs || 0,
        retryConfig: action.retryConfig || { maxRetries: 0, retryCount: 0, retryDelayMs: 2000 },
        requiresIntervention: false,
        isBulk: false
    })),
    intentData: {
        trigger: workflowData.trigger,
        condition: { raw_text: workflowData.conditionRawText || "" },
        conditions: workflowData.conditions
    },
    triggerConfig: workflowData.trigger,
    conditions: workflowData.conditions || [],
    conditionLogic: workflowData.conditionLogic || "AND",
    conditionRawText: workflowData.conditionRawText || "",
    executionLogs: []
});


// ===========================================
// ASYNC EXECUTION ENGINE (with Background & Intervention Handling)
// ===========================================
const simulateExecution = async (workflowId, actionDefs) => {
    const { executeStep, validateStep } = require("../services/actionExecutionService");

    try {
        let wf = await ActionWorkflow.findById(workflowId);
        if (!wf) return;

        const context = {
            workflowId: workflowId.toString(),
            workflowTitle: wf.title,
            userEmail: process.env.EMAIL_USER
        };

        for (let i = 0; i < wf.steps.length; i++) {
            wf = await ActionWorkflow.findById(workflowId);
            if (!wf || wf.status === 'failed') break;

            const step = wf.steps[i];
            
            // --- DECISION ENGINE: Validation ---
            const validation = validateStep(step);
            if (validation.isBlocked) {
                wf.status = "intervention";
                wf.activeMicroLog = validation.context;
                wf.steps[i].status = "intervention";
                wf.steps[i].interventionMsg = validation.context;
                addLog(wf, i, step, "warn", `Paused: Intervention required for "${step.label}"`);
                await wf.save();
                return; // Stop execution until user provides input
            }

            const actionDef = actionDefs?.find(a => a.id === step.id);
            const maxRetries = step.retryConfig?.maxRetries || actionDef?.retryConfig?.maxRetries || 0;
            const retryDelayMs = step.retryConfig?.retryDelayMs || actionDef?.retryConfig?.retryDelayMs || 2000;

            // --- REVERSIBILITY & CONFIRMATION ---
            if (step.isReversible === false && wf.confirmationStatus === 'pending') {
                wf.status = "waiting";
                wf.activeMicroLog = "Awaiting confirmation for irreversible action...";
                addLog(wf, i, step, "info", `Waiting for confirmation: ${step.label} is an irreversible task.`);
                await wf.save();

                // Send Email Notification
                sendConfirmationNotification(wf, step).catch(err => console.error("Notification failed:", err.message));

                // Wait loop for auto-accept or user confirm
                let confirmed = false;
                while (!confirmed) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    wf = await ActionWorkflow.findById(workflowId);
                    if (!wf || wf.status === 'failed') return;

                    if (wf.confirmationStatus === 'confirmed') {
                        confirmed = true;
                    } else if (wf.autoAcceptAt && Date.now() > new Date(wf.autoAcceptAt).getTime()) {
                        wf.confirmationStatus = 'auto-confirmed';
                        addLog(wf, i, step, "info", "Confirmation requirement auto-accepted (timeout reached).");
                        confirmed = true;
                    }

                    if (confirmed) {
                        wf.status = "running";
                        await wf.save();
                    }
                }
            }

            // Handle step delay (delayed execution)
            if (step.delayMs > 0) {
                wf.steps[i].status = "delayed";
                wf.activeMicroLog = `Waiting ${Math.round(step.delayMs / 1000)}s before executing ${step.label}...`;
                addLog(wf, i, step, "info", `Delayed execution: waiting ${Math.round(step.delayMs / 1000)}s`);
                await wf.save();
                await new Promise(resolve => setTimeout(resolve, Math.min(step.delayMs, 30000)));
            }

            // Mark running
            wf = await ActionWorkflow.findById(workflowId);
            wf.steps[i].status = "running";
            wf.activeMicroLog = step.microLogs?.[0] || `Executing ${step.label}...`;
            addLog(wf, i, step, "info", `Started: ${step.label}`);
            await wf.save();

            // REAL EXECUTION with retry logic
            let success = false;
            let retryCount = 0;
            let lastError = null;
            let result = null;

            while (!success && retryCount <= maxRetries) {
                try {
                    // Update micro log during execution
                    if (retryCount > 0) {
                        wf = await ActionWorkflow.findById(workflowId);
                        wf.activeMicroLog = step.microLogs?.[1] || `Re-executing ${step.label} (attempt ${retryCount + 1})...`;
                        await wf.save();
                    }

                    // >>> REAL EXECUTION CALL <<<
                    result = await executeStep(step, context);
                    success = true;

                    // Atomic update for micro log and PERSIST DATA
                    await ActionWorkflow.findOneAndUpdate(
                        { _id: workflowId, "steps.id": step.id },
                        { 
                            $set: { 
                                "steps.$.resultData": result.data || null,
                                "steps.$.status": "completed",
                                activeMicroLog: result.message || `${step.label} completed.`
                            }
                        }
                    );

                } catch (stepErr) {
                    lastError = stepErr;
                    retryCount++;
                    wf = await ActionWorkflow.findById(workflowId);
                    wf.steps[i].status = "retrying";
                    wf.steps[i].retryConfig.retryCount = retryCount;
                    wf.activeMicroLog = `Retrying ${step.label} (attempt ${retryCount}/${maxRetries})...`;
                    addLog(wf, i, step, "warn", `Retry ${retryCount}/${maxRetries}: ${stepErr.message}`);
                    await wf.save();

                    if (retryCount <= maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelayMs * retryCount));
                    }
                }
            }

            // Mark completed or failed
            wf = await ActionWorkflow.findById(workflowId);
            if (success) {
                wf.steps[i].status = "completed";
                const logMsg = result?.message ? `Completed: ${step.label} — ${result.message}` : `Completed: ${step.label}`;
                addLog(wf, i, step, "success", logMsg);
            } else {
                wf.steps[i].status = "failed";
                wf.status = "failed";
                wf.activeMicroLog = `Step "${step.label}" failed: ${lastError?.message || 'Unknown error'}`;
                addLog(wf, i, step, "error", `Failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
                await wf.save();
                return;
            }
            await wf.save();
        }

        // Mark entire workflow completed
        wf = await ActionWorkflow.findById(workflowId);
        if (wf && wf.status !== "intervention" && wf.status !== "failed") {
            const allCompleted = wf.steps.every(s => s.status === 'completed');
            if (allCompleted) {
                wf.status = "completed";
                wf.activeMicroLog = "All tasks finished successfully!";
                wf.endTime = Date.now();
                addLog(wf, null, null, "success", "Workflow completed successfully");
                await wf.save();
            }
        }
    } catch (err) {
        console.error("Async Execution Failed:", err);
        try {
            const wf = await ActionWorkflow.findById(workflowId);
            if (wf) {
                wf.status = "failed";
                wf.activeMicroLog = `Error: ${err.message}`;
                addLog(wf, null, null, "error", `Critical error: ${err.message}`);
                await wf.save();
            }
        } catch (e) {
            console.error(e);
        }
    }
};

/**
 * Helper to notify user about an irreversible task awaiting confirmation
 */
const sendConfirmationNotification = async (wf, step) => {
    const sendEmail = require("../utils/sendEmail");
    const recipient = process.env.EMAIL_USER || "user@example.com";
    
    const subject = `⚠️ Confirmation Required: ${wf.title}`;
    const autoAcceptStr = wf.autoAcceptAt ? new Date(wf.autoAcceptAt).toLocaleTimeString() : "15 minutes";
    
    const message = `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #6c5ce7;">Action Confirmation Required</h2>
            <p>The Nurotra Action Agent is performing the following irreversible task and needs your approval:</p>
            <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #6c5ce7; margin: 20px 0;">
                <strong>Task:</strong> ${wf.title}<br/>
                <strong>Current Step:</strong> ${step.label}
            </div>
            <p><strong>Auto-Accept Clause:</strong> If no action is taken, this task will be automatically confirmed at <strong>${autoAcceptStr}</strong> to maintain workflow momentum.</p>
            <div style="margin-top: 30px;">
                <a href="http://localhost:5173/#/action-agent" style="background: #6c5ce7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review in Dashboard</a>
            </div>
        </div>
    `;

    return sendEmail({
        email: recipient,
        subject,
        message
    });
};

/**
 * Helper to append an execution log entry
 */
const addLog = (wf, stepIndex, step, level, message) => {
    if (!wf.executionLogs) wf.executionLogs = [];
    wf.executionLogs.push({
        stepId: step?.id || stepIndex,
        stepLabel: step?.label || "System",
        status: level,
        message,
        timestamp: new Date(),
        level
    });
};
