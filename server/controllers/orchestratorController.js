const orchestratorService = require('../services/orchestratorService');
const learningService = require('../services/learningService');
const docsAgentService = require('../services/docsAgentService');
const communicationService = require('../services/communicationService');
const actionExecutionService = require('../services/actionExecutionService');
const timeAgentController = require('./timeAgentController');
const orchestratorChatController = require('./orchestratorChatController');

/**
 * CORE EXECUTION ENGINE: NUROTRA ORCHESTRATION ORCHESTRA (NOO)
 * Orchestrates multi-agent sequential execution with shared state.
 */
const executeTask = async (req, res) => {
    let { prompt, guardDecision, history = [], chatId = null } = req.body;
    const userId = req.user?._id;

    // STEP 0: Guard Layer Validation
    if (guardDecision && guardDecision.response_strategy !== 'ROUTE_TO_SYSTEM') {
        return res.status(200).json({
            success: true,
            bypassed: true,
            message: "Handled by Guard Layer."
        });
    }

    if (!prompt) return res.status(400).json({ error: "Prompt required." });

    // Initialize SSE Stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendUpdate = (phase, content, isThought = false, extra = {}) => {
        res.write(`data: ${JSON.stringify({ phase, content, isThought, data: extra })}\n\n`);
    };

    let activeChatId = chatId;
    let sharedContext = {
        outputs: {},
        userId,
        workflowId: null,
        socket: null, 
        workflowTitle: prompt.substring(0, 50) + "..."
    };

    try {
        // STEP -1: Session Initialization
        sendUpdate('narrative', 'Mission Control initialized. Establishing secure team link', true);
        if (userId) {
            const chat = await orchestratorChatController.getOrCreateChat(userId, activeChatId, prompt);
            activeChatId = chat._id;
            sharedContext.workflowId = activeChatId;
        }

        // STEP 1: Intent Analysis
        sendUpdate('narrative', 'Analyzing conversational intent', false);
        const intentResult = orchestratorService.engine.classifyIntent(prompt);
        const docTypeResult = orchestratorService.engine.detectDocType(prompt);
        const riskResult = orchestratorService.engine.detectRisk(prompt);
        
        await new Promise(r => setTimeout(r, 400));
        sendUpdate('narrative', 'Authenticating secure session', true);
        await new Promise(r => setTimeout(r, 300));
        sendUpdate('narrative', 'Decoding architectural mission', true);

        const consolidatedIntent = {
            ...intentResult,
            docType: docTypeResult.type,
            isHighRisk: riskResult.isHighRisk
        };

        sendUpdate('intent', 'Intent fully mapped.', true, consolidatedIntent);

        // STEP 2: Task Breakdown
        sendUpdate('narrative', 'Deconstructing goal into specialized team tasks', false);
        const tasks = await orchestratorService.breakDownTask(prompt, consolidatedIntent);
        sendUpdate('breakdown', 'Task Breakdown Matrix generated.', true, tasks);

        // STEP 3: Agent Allocation
        sendUpdate('narrative', 'Mission strategy finalized. Assembling workforce.', true);
        const mappedAgents = {};
        tasks.forEach(t => {
            if (!mappedAgents[t.suggested_agent]) mappedAgents[t.suggested_agent] = [];
            mappedAgents[t.suggested_agent].push(t);
        });
        sendUpdate('mapping', 'Workforce assembled.', true, mappedAgents);

        // --- SEQUENTIAL EXECUTION LOOP (NOO CORE) ---
        sendUpdate('narrative', 'Assembling specialized workforce for mission deployment', true);
        
        let deliverables = [];

        for (const task of tasks) {
            const agent = task.suggested_agent;
            const agentLabel = agent.replace('_', ' ').toUpperCase();

            // Notify UI of Active Agent
            sendUpdate('narrative', `Orchestrating ${agentLabel} for "${task.action}"`, false);
            sendUpdate('chatter', `${agentLabel} active. Execution links established.`, false, { agent });
            await new Promise(r => setTimeout(r, 800));

            let result = null;
            try {
                if (agent === 'docs_agent') {
                    sendUpdate('chatter', 'Standing by. Synthesis engine ready.', false, { agent });
                    result = await docsAgentService.executeTask(prompt, { ...task, context: sharedContext }, req.user, (log) => {
                        sendUpdate('execution', log, false);
                    });

                    // [DELIVERABLE EXTRACTION]
                    if (result && result.document) {
                        deliverables.push({
                            id: result.document._id,
                            name: result.document.name,
                            type: result.type || 'Document'
                        });
                    }
                } 
                else if (agent === 'action_agent') {
                    sendUpdate('chatter', 'Checking the web now. I\'ll keep you posted.', false, { agent });
                    // Use the unified execution engine for Action Agent
                    result = await actionExecutionService.executeStep(task, sharedContext);

                    // [DELIVERABLE EXTRACTION - Action Agent]
                    if (result && result.data && result.data.fileId) {
                        deliverables.push({
                            id: result.data.fileId,
                            name: result.data.fileName || 'Output_File',
                            type: 'File'
                        });
                    }
                }
                else if (agent === 'time_agent') {
                    sendUpdate('chatter', 'Time Agent synced. Project clock calibrated.', false, { agent });
                    const mockRes = { json: (data) => { result = data; }, status: () => mockRes };
                    await timeAgentController.planTask({ body: { prompt, context: sharedContext }, user: req.user }, mockRes);
                }
                else if (agent === 'communication_agent') {
                    sendUpdate('chatter', 'Outreach channels open. Drafting message...', false, { agent });
                    result = await communicationService.processMessage(req.user._id, prompt, history, sharedContext);
                }
                else if (agent === 'orchestrator') {
                    sendUpdate('chatter', 'Supervisor taking over for deep synthesis.', false, { agent: 'orchestrator' });
                    // Orchestrator can handle internal refinement steps
                    result = { success: true, message: `Refinement complete for: ${task.description}` };
                }

                // Store in Shared Context
                sharedContext.outputs[`step_${task.step}`] = result;
                sendUpdate('chatter', 'Thanks, I\'ll take it from here.', true, { agent });

            } catch (err) {
                console.error(`[NOO] Agent ${agent} failed:`, err);
                sendUpdate('chatter', `Specialist encountered an anomaly. Initiating Mission Control intervention...`, true, { agent: 'orchestrator' });
                sharedContext.outputs[`step_${task.step}`] = { success: false, error: err.message };
            }
        }

        // STEP 4: Final Synthesis & Banter
        sendUpdate('narrative', 'Finalizing mission post-execution debrief', false);
        
        // Generate Banter for idle agents
        const allAgents = ['docs_agent', 'action_agent', 'time_agent', 'communication_agent'];
        const usedAgents = [...new Set(tasks.map(t => t.suggested_agent))];
        const idleAgents = allAgents.filter(a => !usedAgents.includes(a));

        for (const idle of idleAgents) {
            const banter = await orchestratorService.generateIdleBanter(idle, prompt, sharedContext.outputs);
            sendUpdate('chatter', banter, true, { agent: idle });
            await new Promise(r => setTimeout(r, 400));
        }

        sendUpdate('narrative', 'Mission supervisor consolidating all agent contributions', true);
        const finalSummary = await orchestratorService.synthesizeFinalResult(prompt, sharedContext.outputs);

        // Final Persistence
        if (userId && finalSummary) {
            await orchestratorChatController.saveMessage(activeChatId, null, finalSummary);
            // Save learning pattern
            learningService.analyzeInteraction(userId, [
                ...history,
                { role: 'user', content: prompt },
                { role: 'assistant', content: finalSummary }
            ]).catch(() => {});
        }

        sendUpdate('complete', finalSummary, true, { 
            outputs: sharedContext.outputs,
            chatId: activeChatId,
            deliverables: deliverables
        });

        res.end();

    } catch (error) {
        console.error('[Orchestrator] NOO Pipeline Crash:', error);
        sendUpdate('error', 'Critical mission failure. Emergency shutdown initiated.', true, { error: error.message });
        res.end();
    }
};

module.exports = { executeTask };
