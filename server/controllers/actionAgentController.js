const mongoose = require("mongoose");
const actionAgentService = require("../services/actionAgentService");
const eventListenerService = require("../services/eventListenerService");
const ActionWorkflow = require("../models/ActionWorkflow");
const EventRule = require("../models/EventRule");
const ActionMessage = require("../models/ActionMessage");
const User = require("../models/User");
const Document = require("../models/Document");
const Resource = require("../models/Resource");
const agentResourceService = require("../services/agentResourceService");
const systemLoggerService = require("../services/systemLoggerService");
const browserAgentService = require("../services/browserAgentService");
const { executeStep, mapStepToExecutor } = require("../services/actionExecutionService");
const SystemExecutionLog = require("../models/SystemExecutionLog");

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

        const socketId = req.headers['x-socket-id'];

        // 1. Check for Active Intervention or Running Tasks
        const userId = req.user ? req.user._id : DEV_USER_ID;
        const userIdFilter = { userId };
        
        const activeTask = await ActionWorkflow.findOne({ 
            ...userIdFilter, 
            status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] },
            type: { $ne: 'scheduled' }
        });

        // 2. Resume Intervention if it exists
        if (activeTask && activeTask.status === "intervention") {
            const userMsg = new ActionMessage({
                userId,
                role: "user",
                content: command,
                type: "text"
            });
            await userMsg.save();

            // Check if this is a resume ingestion intervention
            const resumeMatch = command.match(/I've uploaded my resume: ([a-f0-9]{24})/i);
            if (resumeMatch) {
                const documentId = resumeMatch[1];
                const doc = await Document.findById(documentId);
                if (doc) {
                    await agentResourceService.ingestResume(userId, doc.content, documentId);
                    
                    // Add confirmation message
                    await new ActionMessage({
                        userId,
                        role: "agent",
                        content: "I have successfully saved your resume details to my Resource Engine. I'll use these to assist you with high precision for all future tasks.",
                        type: "text"
                    }).save();
                }
            }

            // Store the response in the active micro log and resume
            activeTask.activeMicroLog = `Resuming with user input: "${command}"`;
            activeTask.status = "running";
            
            // Inject the answer into the current step's resultData for the executor to see
            const currentStep = activeTask.steps.find(s => s.status === "intervention") || activeTask.steps[0];
            if (currentStep) {
                currentStep.status = "running";
                currentStep.resultData = { ...currentStep.resultData, interventionResponse: command };
            }
            await activeTask.save();

            if (req.io) req.io.emit('chat_update', { userId });
            console.log(`[DEBUG] Resuming active task ${activeTask._id} for user ${userId}`);

            // Trigger resumption in the background
            simulateExecution(activeTask._id, activeTask.steps, req.io, { socketId });

            return res.json({ 
                success: true, 
                message: "Resuming task with your provided details...",
                workflowId: activeTask._id 
            });
        }

        // 3. Block if another task is actually running (not intervention)
        if (activeTask && activeTask.status !== "intervention") {
            return res.status(400).json({ success: false, message: "A task is already in progress. Please wait for it to finish or pause it before starting a new one." });
        }

        // 1. Save User Message
        const userMsg = new ActionMessage({
            userId,
            role: "user",
            content: command,
            type: "text"
        });
        await userMsg.save();
        console.log(`[DEBUG] User message saved: ${userMsg._id}`);

        // 2. Analyze Intent using NLP
        const user = req.user ? await User.findById(req.user._id) : await User.findById(DEV_USER_ID);
        console.log(`[DEBUG] Analyzing intent for user ${user?._id || 'Unknown'}: "${command}"`);
        let parsedData = await actionAgentService.parseActionIntent(command, user ? user.personaMemory : {});
        console.log(`[DEBUG] NLP Intent: ${parsedData.intent}`);

        // FORCED CONTINUITY INTERCEPTOR: If user wants to go deep, force intent to FOLLOW_UP
        const continuityKeywords = ["go deep", "analyze further", "explore more", "tell me more", "expand on", "analyze more", "go deeper"];
        const isContinuityRequest = continuityKeywords.some(key => command.toLowerCase().includes(key));
        
        if (isContinuityRequest && parsedData.intent === "CLARIFICATION") {
            console.log("[Controller] Forced continuity intercepted for command:", command);
            parsedData.intent = "FOLLOW_UP";
        }

        // RESUME GUARD: For job applications, ensure we have a master profile
        const isJobTask = command.toLowerCase().match(/apply|job|internship|resume|career|vacancy/i);
        if (parsedData.intent === "WORKFLOW_EXECUTION" && isJobTask) {
            const masterProfile = await agentResourceService.getMasterProfile(userId);
            if (!masterProfile) {
                console.log(`[Controller] Blocking job task for user ${userId} - Missing master profile.`);
                const interventionMsg = new ActionMessage({
                    userId,
                    role: "agent",
                    content: "I'm ready to help you apply! However, I don't have your resume details in my Resource Engine yet. Please upload your resume so I can accurately fill forms and represent your skills.",
                    type: "intervention",
                    metadata: { subtype: 'resume_upload' }
                });
                await interventionMsg.save();
                
                // Create a placeholder workflow in 'intervention' status
                const interventionWorkflow = new ActionWorkflow({
                    userId,
                    title: `Job Application: ${command}`,
                    status: "intervention",
                    intent: "application_flow",
                    steps: [{ title: "Upload Resume & Parse Profile", status: "intervention" }]
                });
                await interventionWorkflow.save();

                if (req.io) req.io.emit('chat_update', { userId });
                return res.json({ success: true, message: "Awaiting resume upload...", workflowId: interventionWorkflow._id });
            }
        }

        if (parsedData.intent === "CLARIFICATION") {
            await new ActionMessage({
                userId,
                role: "system",
                content: parsedData.question,
                type: "clarification"
            }).save();

            if (req.io) req.io.emit('chat_update', { userId });

            return res.json({
                success: true,
                intent: "CLARIFICATION",
                question: parsedData.question
            });
        }

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

        if (parsedData.intent === "FOLLOW_UP") {
            // Find the most recently completed or stopped task to get context
            const lastTask = await ActionWorkflow.findOne({
                userId,
                status: { $in: ["completed", "stopped"] }
            }).sort({ endTime: -1 });

            if (!lastTask) {
                return res.json({
                    success: true,
                    intent: "CLARIFICATION",
                    question: "I'm ready to dive deeper, but I don't see a recent search or task in this session to continue from. What would you like me to research for you?"
                });
            }

            // Map previous findings into a new "Deep Dive" request
            console.log(`[Controller] Continuing from task: ${lastTask.title}`);
            const previousFindings = lastTask.executionLogs?.map(l => l.message).join("\n").substring(0, 2000) || "No logs available.";
            
            const followUpCommand = `Please go deep and analyze further based on these previous findings: ${previousFindings}. Specifically address: ${command}`;
            const followUpData = await actionAgentService.parseActionIntent(followUpCommand, user ? user.personaMemory : []);
            
            if (followUpData.intent === "WORKFLOW_EXECUTION") {
                parsedData.intent = "WORKFLOW_EXECUTION";
                parsedData.workflow = followUpData.workflow;
                parsedData.workflow.title = `Deep Dive: ${lastTask.title}`;
            } else {
                return res.json({
                    success: true,
                    intent: "CLARIFICATION",
                    question: "I understand you want more details. Could you specify which part of the previous results I should explore further?"
                });
            }
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
                    actions: workflowData.actions.map((action, index) => ({
                        id: parseInt(action.id) || index + 1,
                        label: action.label,
                        icon: action.icon || "default",
                        delayMs: parseInt(action.delayMs) || 2000,
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
                steps: workflowData.actions.map((action, idx) => {
                    // Strict parsing for irreversibility (handle strings or booleans)
                    let isRev = true;
                    if (action.isReversible === false || action.isReversible === 'false') {
                        isRev = false;
                    }

                    return {
                        id: parseInt(action.id) || idx + 1,
                        label: action.label,
                        icon: action.icon || "default",
                        status: "pending",
                        microLogs: action.microLogs || [],
                        delayMs: parseInt(action.delayMs) || 0,
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
                `Starting: ${workflowData.title}`, 
                "workflow_preview", 
                { title: workflowData.title, workflowId: finalWorkflow._id }
            );

            // 3. Persist and Start Execution
            const workflowId = finalWorkflow._id;

            // --- Capture Memory facts if present in actions ---
            if (workflowData.actions.some(a => a.params?.saveFact)) {
                const memoryActions = workflowData.actions.filter(a => a.params?.saveFact);
                for (const factAction of memoryActions) {
                    const { key, value } = factAction.params.saveFact;
                    if (key && value && user) {
                        if (!user.personaMemory) user.personaMemory = new Map();
                        user.personaMemory.set(key, value);
                    }
                }
                if (user) await user.save();
            }

            // --- LLM-Style Immediate Interaction ---
            // Send an immediate acknowledgment to "connect" with the user while background work begins
            await new ActionMessage({
                userId,
                role: "system",
                content: `Certainly! I've started working on "${finalWorkflow.title}" for you. I'll analyze everything and get back to you with a report in just a moment.`,
                type: "text",
                timestamp: new Date()
            }).save();
            
            // Notify frontend
            if (req.io) req.io.emit('chat_update', { userId });

            // Begin background simulation
            simulateExecution(workflowId, workflowData.actions, req.io, { socketId });

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
        
        if (res.headersSent) return;

        // Handle AI specific errors gracefully
        const aiErrorMsg = error.message || "";
        if (aiErrorMsg.includes("AI") || aiErrorMsg.includes("Gemini") || aiErrorMsg.includes("OpenAI") || aiErrorMsg.includes("keys configured")) {
            return res.status(503).json({ 
                success: false, 
                message: "AI Engine Processing Error: " + error.message,
                suggestion: "This usually happens when AI keys are missing, rate-limited, or hit context limits. Check your .env or Settings."
            });
        }
        
        // Return specific validation error if possible
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false, 
                message: "Validation Error: " + Object.values(error.errors).map(e => e.message).join(", ") 
            });
        }
        
        const errorMsg = error.isAiFailure ? error.message : "Server error during execution: " + error.message;
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
// STOP WORKFLOW
// ===========================================
exports.stopWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const wf = await ActionWorkflow.findById(id);
        if (!wf) return res.status(404).json({ success: false, message: "Task not found." });

        wf.status = "stopped";
        wf.activeMicroLog = "Execution stopped by user.";
        addLog(wf, null, null, "error", "Execution stopped by user.", req.io, null, true);
        await wf.save();

        // Also terminate browser if it was a browser task
        await browserAgentService.restartSession(wf.userId);

        res.json({ success: true, message: "Task stopped." });
    } catch (err) {
        console.error("Stop Workflow Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ===========================================
// PAUSE WORKFLOW
// ===========================================
exports.pauseWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const wf = await ActionWorkflow.findById(id);
        if (!wf) return res.status(404).json({ success: false, message: "Task not found." });

        if (wf.status === 'paused') {
            wf.status = "running";
            wf.activeMicroLog = "Resuming execution...";
            addLog(wf, null, null, "info", "Execution resumed.", req.io, null, true);
        } else {
            wf.status = "paused";
            wf.activeMicroLog = "Execution paused by user.";
            addLog(wf, null, null, "warn", "Execution paused.", req.io, null, true);
        }
        await wf.save();

        res.json({ success: true, message: wf.status === 'paused' ? "Task paused." : "Task resumed.", status: wf.status });
    } catch (err) {
        console.error("Pause Workflow Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
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
const simulateExecution = async (workflowId, actionDefs, io = null, options = {}) => {
    const { socketId } = options;
    const { executeStep, validateStep } = require("../services/actionExecutionService");

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
            // --- SYNC STATE ---
            wf = await ActionWorkflow.findById(workflowId);
            if (!wf || wf.status === 'failed' || wf.status === 'stopped') {
                if (wf?.status === 'stopped') addLog(wf, i, wf.steps[i], "error", `Terminated at step: ${wf.steps[i]?.label}`, io, null, true);
                break;
            }

            // --- PAUSE LOOP ---
            while (wf.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 2000));
                wf = await ActionWorkflow.findById(workflowId);
                if (!wf || wf.status === 'stopped' || wf.status === 'failed') break;
            }
            if (!wf || wf.status === 'stopped' || wf.status === 'failed') break;

            const step = wf.steps[i];
            
            // --- DECISION ENGINE: Validation ---
            const validation = validateStep(step);
            if (validation.isBlocked) {
                wf.status = "intervention";
                wf.activeMicroLog = validation.context;
                wf.steps[i].status = "intervention";
                wf.steps[i].interventionMsg = validation.context;
                addLog(wf, i, step, "warn", `Paused: Intervention required for "${step.label}"`, io);
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
                addLog(wf, i, step, "info", `Waiting for confirmation: ${step.label} is an irreversible task.`, io);
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
                        addLog(wf, i, step, "info", "Confirmation requirement auto-accepted (timeout reached).", io);
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
                addLog(wf, i, step, "info", `Delayed execution: waiting ${Math.round(step.delayMs / 1000)}s`, io);
                await wf.save();
                await new Promise(resolve => setTimeout(resolve, Math.min(step.delayMs, 30000)));
            }

            // Mark running
            wf = await ActionWorkflow.findById(workflowId);
            // Push a chat update for the step start ONLY if it's high impact
            const isHighImpact = mapStepToExecutor(step) === 'submit_form' || mapStepToExecutor(step) === 'execute_output_delivery';
            if (isHighImpact) {
                await new ActionMessage({
                    userId: wf.userId,
                    role: "system",
                    content: `Preparing high-impact action: ${step.label}. Please monitor the execution screen.`,
                    type: "text",
                    timestamp: new Date()
                }).save();
                if (io) io.emit('chat_update');
                
                // User requirement: Auto-pause for high-impact tasks
                wf.status = "paused";
                wf.activeMicroLog = `Awaiting confirmation for high-impact action: ${step.label}`;
                addLog(wf, i, step, "warn", `Paused for verification: ${step.label}`, io, null, true);
                await wf.save();

                while (wf.status === 'paused') {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    wf = await ActionWorkflow.findById(workflowId);
                    if (wf.status === 'stopped' || wf.status === 'failed') break;
                }
                if (wf.status === 'stopped' || wf.status === 'failed') break;
            }

            wf.steps[i].status = "running";
            wf.activeMicroLog = step.microLogs?.[0] || `Executing ${step.label}...`;
            addLog(wf, i, step, "info", `Started: ${step.label}`, io, null, isHighImpact);
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
                    // Strategically push high-level milestone to chat for context
                    const executorKey = mapStepToExecutor(step);
                    if (executorKey === 'web_search') {
                        await addMilestone(wf.userId, `🌐 Analyzing live data for: "${step.label}"`, io);
                    } else if (executorKey === 'submit_form') {
                        await addMilestone(wf.userId, `📝 Finalizing form/application submission...`, io);
                    } else if (executorKey === 'platform_execution') {
                        await addMilestone(wf.userId, `⚙️ Syncing data with ${step.params?.platform || 'platform'}...`, io);
                    }

                    result = await executeStep(step, { ...context, socket: io, socketId }); // Pass io as socket for real-time frames
                    success = true;

                    // --- ODE HANDOFF: Store result for next step ---
                    context.lastResult = result;
                    if (result.data?.link) context.fileLink = result.data.link;
                    if (result.data?.fileName) context.fileName = result.data.fileName;

                    // Update micro log with result
                    wf = await ActionWorkflow.findById(workflowId);
                    wf.activeMicroLog = result.message || `${step.label} completed.`;
                    await wf.save();
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
                    wf.activeMicroLog = `Trying again: ${step.label} (attempt ${retryCount} of ${maxRetries})...`;
                    addLog(wf, i, step, "warn", `Retrying (${retryCount}/${maxRetries}): ${stepErr.message}`, io);
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
                addLog(wf, i, step, "success", logMsg, io);
                if (sysLogId) await systemLoggerService.addStep(sysLogId, { label: step.label, status: "completed", message: logMsg, metadata: result });
                
                // FINAL PROOF CAPTURE: If this was the last step or a data-heavy step
                if (i === wf.steps.length - 1) {
                    try {
                        const evidenceUrl = await browserAgentService.captureFinalProof(wf.userId, workflowId);
                        if (evidenceUrl) {
                            addLog(wf, i, step, "success", "Final execution proof captured.", io, evidenceUrl);
                            context.evidenceUrl = evidenceUrl;
                        }
                    } catch (e) {
                        console.error("Proof capture failed:", e.message);
                    }
                }
            } else {
                wf.steps[i].status = "failed";
                wf.status = "failed";
                wf.activeMicroLog = `Encountered an issue with "${step.label}": ${lastError?.message || 'The request couldn\'t be completed.'}`;
                wf.endTime = Date.now();
                addLog(wf, i, step, "error", `Stopped after ${maxRetries} attempts: ${lastError?.message || 'Error details unavailable.'}`, io);
                await wf.save();
                
                if (sysLogId) {
                    await systemLoggerService.addStep(sysLogId, { label: step.label, status: "failed", message: lastError?.message || 'Unknown error', retryCount });
                    await systemLoggerService.concludeLog(sysLogId, "Failed", `Step failed: ${step.label}`);
                }

                // Instead of returning early, we break the loop to allow final response generation
                break;
            }
            await wf.save();
        }

        // 4. Wrap up and Generate Final Agent Response
        wf = await ActionWorkflow.findById(workflowId);
        if (wf) {
            if (wf.status !== "failed") {
                wf.status = "completed";
                wf.endTime = Date.now();
                wf.activeMicroLog = "Task completed successfully.";
                await addMilestone(wf.userId, `✅ Task Completed: ${wf.title}. All objectives reached.`, io);
            }
            
            addLog(wf, null, null, "success", "Final response generated", io, context.evidenceUrl);
            await wf.save();

            // Build a clean, human-readable summary
            const resultSections = [];
            for (const s of wf.steps.filter(s => s.status === 'completed')) {
                const allLogs = wf.executionLogs.filter(l => l.stepId === s.id && l.level === 'success');
                let extracted = s.resultData?.answer 
                            || allLogs.reverse().find(l => l.message.includes(' — '))?.message?.split(' — ')[1] 
                            || null;

                if (extracted) {
                    resultSections.push(`📌 ${s.label}:\n${extracted}`);
                }
            }

            let finalSummary;
            if (wf.status === "failed") {
                finalSummary = `⚠️ Task Update: ${wf.title}\n\nI was able to complete some parts of your request, but I encountered an issue during the final steps.\n\n${resultSections.length > 0 ? "What I found so far:\n" + resultSections.join('\n\n') : ""}\n\nPlease let me know if you would like me to try a different approach.`;
            } else {
                finalSummary = resultSections.length > 0 
                    ? `✅ Task Complete: ${wf.title}\n\n${resultSections.join('\n\n')}`
                    : `✅ Task Complete: ${wf.title}\n\nAll objectives were reached successfully.`;
            }
            
            if (sysLogId) await systemLoggerService.concludeLog(sysLogId, wf.status === "failed" ? "Failed" : "Completed", "Process finalized.");
            
            await new ActionMessage({
                userId: wf.userId,
                role: "agent",
                content: finalSummary,
                type: "browser_result",
                metadata: { evidenceUrl: context.evidenceUrl },
                timestamp: new Date()
            }).save();
            
            if (io) io.emit('chat_update', { userId: wf.userId });

            // 5. Send Professional Execution Summary via Email
            try {
                const user = await User.findById(wf.userId);
                if (user && user.email) {
                    await sendExecutionSummary(user.email, wf, finalSummary, resultSections, context.evidenceUrl);
                }
            } catch (emailErr) {
                console.warn("[Email Summary] Failed to send report:", emailErr.message);
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
                addLog(wf, null, null, "error", `Critical error: ${err.message}`, io);
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
 * Sends a rich, professional execution summary to the user's email.
 */
const sendExecutionSummary = async (email, wf, summary, sections, evidenceUrl) => {
    const sendEmail = require("../utils/sendEmail");
    const subject = `📊 Execution Report: ${wf.title}`;
    
    const sectionHtml = sections.map(s => `
        <div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #6c5ce7;">
            <div style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 8px;">${s.split(':\n')[0]}</div>
            <div style="font-size: 13px; color: #555; line-height: 1.5;">${s.split(':\n')[1] || ''}</div>
        </div>
    `).join('');

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
            <div style="background: #000; padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px;">NUROTRA</h1>
                <p style="color: #a29bfe; margin: 10px 0 0 0; font-size: 12px; text-transform: uppercase;">Action Agent Execution Summary</p>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #333; font-size: 18px; margin-top: 0;">Task Objective: ${wf.title}</h2>
                <div style="font-size: 14px; color: #666; margin-bottom: 20px;">Completed on ${new Date().toLocaleString()}</div>
                
                ${sectionHtml}

                ${evidenceUrl ? `
                <div style="margin-top: 30px;">
                    <div style="font-size: 12px; font-weight: bold; color: #888; margin-bottom: 10px; text-transform: uppercase;">Execution Proof</div>
                    <img src="${evidenceUrl}" style="width: 100%; border-radius: 8px; border: 1px solid #eee;" alt="Report Screenshot" />
                </div>
                ` : ''}

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <a href="https://nurotra.online/action-agent" style="background: #6c5ce7; color: #fff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">View full Activity Feed</a>
                </div>
            </div>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 11px; color: #999;">
                This report was generated autonomously by Nurotra Action Agent.<br>
                © 2026 Nurotra AI Labs. Professional Stealth Mode Active.
            </div>
        </div>
    `;

    await sendEmail({
        email,
        subject,
        message: summary, // Text fallback
        html
    });
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
const addLog = (wf, stepIndex, step, level, message, io = null, evidenceUrl = null, isMilestone = false) => {
    if (!wf.executionLogs) wf.executionLogs = [];
    wf.executionLogs.push({
        stepId: step?.id || stepIndex,
        stepLabel: step?.label || "System",
        status: level,
        message,
        evidenceUrl,
        timestamp: new Date(),
        level
    });
    
    // If it's a milestone, also push a chat message for the right pane
    if (isMilestone && io) {
        const ActionMessage = require("../models/ActionMessage");
        new ActionMessage({
            userId: wf.userId,
            role: "system",
            content: message,
            type: "text",
            timestamp: new Date()
        }).save().then(() => {
            io.emit('chat_update', { userId: wf.userId });
        });
    }

    if (io) io.emit('task_update', { userId: wf.userId, workflowId: wf._id });
};

/**
 * Helper to push a strategic milestone to the Chat interface
 */
const addMilestone = async (userId, message, io = null) => {
    const ActionMessage = require("../models/ActionMessage");
    const milestone = new ActionMessage({
        userId,
        role: "system",
        content: message,
        type: "milestone", // specialized type for UI distinction
        timestamp: new Date()
    });
    await milestone.save();
    if (io) io.emit('chat_update', { userId });
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

// ===========================================
// DYNAMIC CAPABILITIES / SUGGESTIONS
// ===========================================
exports.getSuggestions = async (req, res) => {
    try {
        // In a fully dynamic system, this could query active Integrations or Tools.
        // Returning the actual capabilities the Action Agent possesses.
        const capabilities = [
            "Apply to a software engineer job on LinkedIn",
            "Search for current startup funding news",
            "Extract details from Wikipedia about AI",
            "Summarize the latest tech trends"
        ];
        res.json({ success: true, suggestions: capabilities });
    } catch (error) {
        console.error("Get Suggestions Error:", error);
        res.json({ success: false, suggestions: [] });
    }
};

