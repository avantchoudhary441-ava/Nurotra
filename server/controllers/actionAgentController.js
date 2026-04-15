const mongoose = require("mongoose");
const actionAgentService = require("../services/actionAgentService");
const eventListenerService = require("../services/eventListenerService");
const ActionWorkflow = require("../models/ActionWorkflow");
const EventRule = require("../models/EventRule");
const ActionMessage = require("../models/ActionMessage");
const systemLoggerService = require("../services/systemLoggerService");

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

        const userIdFilter = req.user ? { userId: req.user._id } : { userId: DEV_USER_ID };
        
        // Prevent concurrent executions for active tasks
        if (mongoose.connection.readyState === 1) {
            const runningTask = await ActionWorkflow.findOne({ 
                ...userIdFilter, 
                status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] },
                type: { $ne: 'scheduled' }
            });
            if (runningTask) {
                return res.status(400).json({ success: false, message: "Please wait until the current task is fully executed before starting a new one." });
            }
        }

        // 1. Save User Message
        const userId = req.user ? req.user._id : DEV_USER_ID;
        const userMsg = new ActionMessage({
            userId,
            role: "user",
            content: command,
            type: "text"
        });
        await userMsg.save();

        // 2. Analyze Intent using NLP
        const parsedData = await actionAgentService.parseActionIntent(command);

        if (parsedData.intent === "ENVIRONMENT_CONTROL") {
            await new ActionMessage({
                userId,
                role: "system",
                content: `Navigating to ${parsedData.targetDescription || parsedData.navigateTo}...`,
                type: "text"
            }).save();

            return res.json({
                success: true,
                intent: "ENVIRONMENT_CONTROL",
                navigateTo: parsedData.navigateTo,
                environmentAction: parsedData.environmentAction || "navigate",
                targetDescription: parsedData.targetDescription || ""
            });
        }

        if (parsedData.intent === "FETCH_LOGS") {
            const queryParams = parsedData.query || {};
            // Let's map dateRange to states or just pass it as search tokens, but a dedicated UI response is best.
            const logs = await systemLoggerService.getLogs(userId, { 
                agentType: queryParams.agentType,
                searchToken: queryParams.searchToken,
                limit: 20
            });
            
            // Format logs for chat payload
            await new ActionMessage({
                userId,
                role: "system",
                content: `Here are the execution logs regarding your request.`,
                type: "execution_timeline",
                metadata: { logs }
            }).save();

            return res.json({
                success: true,
                intent: "FETCH_LOGS",
                logs
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

            // 2. Build the workflow DB entry
            const newWorkflow = new ActionWorkflow({
                userId: req.user ? req.user._id : DEV_USER_ID,
                title: workflowData.title || "Automated Task",
                type: "active",
                status: "running",
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
                steps: workflowData.actions.map(action => ({
                    id: action.id,
                    label: action.label,
                    icon: action.icon || "default",
                    status: "pending",
                    microLogs: action.microLogs || [],
                    delayMs: action.delayMs || 0,
                    retryConfig: action.retryConfig || { maxRetries: 0, retryCount: 0, retryDelayMs: 2000 },
                    requiresIntervention: false,
                    isBulk: false,
                    params: action.params || {}
                })),
                intentData: {
                    trigger: workflowData.trigger,
                    condition: { raw_text: workflowData.conditionRawText || "" },
                    conditions: workflowData.conditions
                },
                startTime: new Date()
            });

            // Try to save to DB, but don't hang if it fails
            let finalWorkflow = newWorkflow;
            try {
                if (mongoose.connection.readyState === 1) {
                    await newWorkflow.save();
                } else {
                    console.warn("[ActionAgent] DB Offline. Using ephemeral workflow object.");
                    finalWorkflow = { ...newWorkflow.toObject(), _id: `temp_${Date.now()}` };
                }
            } catch (saveErr) {
                console.warn("[ActionAgent] Workflow save failed. Using ephemeral workflow.");
                finalWorkflow = { ...newWorkflow.toObject(), _id: `temp_${Date.now()}` };
            }

            // 3. Save Agent Message Preview (Non-blocking)
            const browserAgentService = require("../services/browserAgentService");
            browserAgentService.safeSaveMessage(
                userId, 
                "system", 
                `Initiating: ${workflowData.title}`, 
                "workflow_preview", 
                { title: workflowData.title, workflowId: finalWorkflow._id }
            );

            // 4. Kick off async execution
            const io = req.app.get("socketio");
            simulateExecution(finalWorkflow._id, workflowData.actions, io);

            return res.json({
                success: true,
                intent: "WORKFLOW_EXECUTION",
                workflow: finalWorkflow,
                isEventDriven: false,
                dbOffline: mongoose.connection.readyState !== 1
            });
        }

        return res.status(400).json({ success: false, message: "Unknown intent parsed." });

    } catch (error) {
        console.error("Action Agent Execute Controller Error:", error);
        const errorMsg = error.isAiFailure ? error.message : "Server error during execution.";
        res.status(500).json({ success: false, message: errorMsg });
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
// GET CHAT HISTORY
// ===========================================
exports.getChatHistory = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, messages: [], dbOffline: true });
        }

        const query = req.user ? { userId: req.user._id } : { userId: DEV_USER_ID };
        const messages = await ActionMessage.find(query).sort({ timestamp: 1 });
        res.json({ success: true, messages });
    } catch (error) {
        console.error("Get Chat History Error:", error);
        res.json({ success: false, messages: [], error: error.message });
    }
};

// ===========================================
// CLEAR CHAT HISTORY
// ===========================================
exports.clearChatHistory = async (req, res) => {
    try {
        const query = req.user ? { userId: req.user._id } : { userId: DEV_USER_ID };
        await ActionMessage.deleteMany(query);
        res.json({ success: true, message: "Chat history cleared." });
    } catch (error) {
        console.error("Clear Chat History Error:", error);
        res.status(500).json({ success: false, message: "Failed to clear chat." });
    }
};

// ===========================================
// GET DYNAMIC SUGGESTIONS
// ===========================================
exports.getSuggestions = async (req, res) => {
    try {
        const { getDynamicSuggestions } = require("../services/actionAgentService");
        const userContext = {
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }),
        };
        const suggestions = await getDynamicSuggestions(userContext);
        res.json({ success: true, suggestions });
    } catch (error) {
        console.error("Get Suggestions Error:", error);
        res.json({
            success: true,
            suggestions: [
                "Search for the latest market trends",
                "Generate a performance report",
                "Send a project update email"
            ]
        });
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
// FETCH ACTIVE TASKS
// ===========================================
exports.getActiveTasks = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, tasks: [], dbOffline: true });
        }
        
        const userIdFilter = req.user ? { userId: req.user._id } : {};
        
        // Find tasks that are currently active
        const activeCriteria = { ...userIdFilter, status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] } };
        const activeTasksList = await ActionWorkflow.find(activeCriteria).sort({ startTime: -1 });
        
        // Find the absolute most recent non-scheduled task (of any status) to keep it visibly on screen
        const latestTask = await ActionWorkflow.findOne({ ...userIdFilter, type: { $ne: 'scheduled' } }).sort({ startTime: -1 });
        
        let allTasks = [...activeTasksList];
        if (latestTask && !allTasks.some(t => t._id.toString() === latestTask._id.toString())) {
            allTasks.push(latestTask);
        }

        // Also fetch scheduled tasks separately so they aren't lost
        const scheduledTasks = await ActionWorkflow.find({ ...userIdFilter, type: 'scheduled', status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] } });
        for (const st of scheduledTasks) {
            if (!allTasks.some(t => t._id.toString() === st._id.toString())) {
                allTasks.push(st);
            }
        }

        res.json({ success: true, tasks: allTasks });
    } catch (err) {
        console.error("Action Agent Fetch Tasks Error:", err.message);
        res.json({ success: true, tasks: [], error: err.message });
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
// ASYNC EXECUTION ENGINE (with retry + delay + logging)
// ===========================================
const simulateExecution = async (workflowId, actionDefs, io = null) => {
    const { executeStep } = require("../services/actionExecutionService");

    try {
        let wf = await ActionWorkflow.findById(workflowId);
        if (!wf) return;

        const context = {
            workflowId: workflowId.toString(),
            workflowTitle: wf.title,
            userId: wf.userId,
            userEmail: process.env.EMAIL_USER,
            socket: io
        };

        // --- INITIATE SYSTEM LOG ---
        const sysLog = await systemLoggerService.initiateLog({
            userId: wf.userId,
            workflowId: wf._id.toString(),
            agentType: "ActionAgent",
            triggerSource: wf.triggerConfig?.source || "User Command",
            systemLog: `Executing workflow: ${wf.title}`,
            priority: "Medium",
            state: "In Progress"
        });
        const sysLogId = sysLog ? sysLog._id : null;

        for (let i = 0; i < wf.steps.length; i++) {
            wf = await ActionWorkflow.findById(workflowId);
            if (!wf || wf.status === 'intervention' || wf.status === 'failed') break;

            const step = wf.steps[i];
            const actionDef = actionDefs.find(a => a.id === step.id);
            const maxRetries = step.retryConfig?.maxRetries || actionDef?.retryConfig?.maxRetries || 0;
            const retryDelayMs = step.retryConfig?.retryDelayMs || actionDef?.retryConfig?.retryDelayMs || 2000;

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
            
            // Push a chat update for the step start
            await new ActionMessage({
                userId: wf.userId,
                role: "system",
                content: `Executing: ${step.label}...`,
                type: "text",
                timestamp: new Date()
            }).save();
            if (io) io.emit('chat_update');

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
                    result = await executeStep(step, { ...context });
                    success = true;

                    // --- ODE HANDOFF: Store result for next step ---
                    context.lastResult = result;
                    if (result.data?.link) context.fileLink = result.data.link;
                    if (result.data?.fileName) context.fileName = result.data.fileName;

                    // Update micro log with result
                    wf = await ActionWorkflow.findById(workflowId);
                    wf.activeMicroLog = result.message || `${step.label} completed.`;
                    await wf.save();

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
                        const isQuotaErr = stepErr.message.toLowerCase().includes('quota') || stepErr.message.toLowerCase().includes('rate');
                        const backoffTime = isQuotaErr ? Math.max(5500, retryDelayMs * retryCount) : (retryDelayMs * retryCount);
                        await new Promise(resolve => setTimeout(resolve, backoffTime));
                    }
                }
            }

            // Mark completed or failed
            wf = await ActionWorkflow.findById(workflowId);
            if (success) {
                wf.steps[i].status = "completed";
                const logMsg = result?.message ? `Completed: ${step.label} — ${result.message}` : `Completed: ${step.label}`;
                addLog(wf, i, step, "success", logMsg);
                if (sysLogId) await systemLoggerService.addStep(sysLogId, { label: step.label, status: "completed", message: logMsg, metadata: result });
            } else {
                wf.steps[i].status = "failed";
                wf.status = "failed";
                wf.activeMicroLog = `Step "${step.label}" failed: ${lastError?.message || 'Unknown error'}`;
                wf.endTime = Date.now();
                addLog(wf, i, step, "error", `Failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
                await wf.save();
                
                if (sysLogId) {
                    await systemLoggerService.addStep(sysLogId, { label: step.label, status: "failed", message: lastError?.message || 'Unknown error', retryCount });
                    await systemLoggerService.concludeLog(sysLogId, "Failed", `Step failed: ${step.label}`);
                }

                await new ActionMessage({
                    userId: wf.userId,
                    role: "system",
                    content: `Workflow failed at step "${step.label}": ${lastError?.message || 'Unknown error'}`,
                    type: "text",
                    timestamp: new Date()
                }).save();
                if (io) io.emit('chat_update');
                
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
                                // Build a clean, human-readable summary for the chat panel
                const resultSections = [];
                for (const s of wf.steps.filter(s => s.status === 'completed')) {
                    const logMsg = wf.executionLogs.find(l => l.stepId === s.id && l.level === 'success')?.message || '';
                    let extracted = null;
                    if (logMsg.includes('Found information:')) {
                        extracted = logMsg.split('Found information:')[1].trim();
                        // If it's JSON, flatten it to readable text
                        if (extracted.startsWith('[') || extracted.startsWith('{')) {
                            try {
                                const parsed = JSON.parse(extracted);
                                const obj = Array.isArray(parsed) ? parsed[0] : parsed;
                                extracted = Object.entries(obj)
                                    .filter(([, v]) => v && typeof v !== 'object')
                                    .map(([k, v]) => `  • ${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`)
                                    .join('\n');
                            } catch {}
                        }
                    } else if (logMsg.includes(' — ')) {
                        const part = logMsg.split(' — ')[1]?.trim();
                        if (part && !['Data fetched','Report generated','Analytics compiled','Database status updated (simulated target)'].includes(part)) {
                            extracted = part;
                        }
                    }
                    if (extracted) {
                        resultSections.push(`📌 ${s.label}:\n${extracted}`);
                    }
                }

                let finalSummary;
                if (resultSections.length > 0) {
                    finalSummary = `✅ Task Complete: ${wf.title}\n\n${resultSections.join('\n\n')}`;
                } else {
                    finalSummary = `✅ Task Complete: ${wf.title}\n\nAll ${wf.steps.length} steps executed successfully.`;
                }
                
                if (sysLogId) await systemLoggerService.concludeLog(sysLogId, "Completed", "Workflow completed successfully.");
                
                await new ActionMessage({
                    userId: wf.userId,
                    role: "system",
                    content: finalSummary,
                    type: "result",
                    timestamp: new Date()
                }).save();
                
                if (io) io.emit('chat_update');
            }
        }
    } catch (err) {
        console.error("Async Execution Failed:", err);
        try {
            const wf = await ActionWorkflow.findById(workflowId);
            if (wf) {
                wf.status = "failed";
                wf.activeMicroLog = `Error: ${err.message}`;
                wf.endTime = Date.now();
                addLog(wf, null, null, "error", `Critical error: ${err.message}`);
                await wf.save();
                
                // Conclude system log as failed if we caught it here
                SystemExecutionLog.findOneAndUpdate(
                    { workflowId: workflowId.toString() },
                    { state: "Failed", systemLog: `Critical error: ${err.message}` }
                ).catch(() => {});

                await new ActionMessage({
                    userId: wf.userId,
                    role: "system",
                    content: `Workflow ${wf.title} failed: ${err.message}`,
                    type: "text",
                    timestamp: new Date()
                }).save();
                if (io) io.emit('chat_update');
            }
        } catch (e) {
            console.error(e);
        }
    }
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
// ===========================================
// RESTART BROWSER ENGINE (Manual Recovery)
// ===========================================
exports.restartBrowser = async (req, res) => {
    try {
        const userId = req.user ? req.user._id : DEV_USER_ID;
        const browserAgentService = require("../services/browserAgentService");
        
        const success = await browserAgentService.restartSession(userId);
        
        if (success) {
            res.json({ success: true, message: "Browser engine restarted successfully." });
        } else {
            res.status(500).json({ success: false, message: "Failed to restart browser." });
        }
    } catch (error) {
        console.error("Restart Browser Controller Error:", error);
        res.status(500).json({ success: false, message: "Internal error during restart." });
    }
};
