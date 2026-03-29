const orchestratorService = require('../services/orchestratorService');
const learningService = require('../services/learningService');
const docsAgentService = require('../services/docsAgentService');
const communicationService = require('../services/communicationService');
const timeAgentController = require('./timeAgentController');
const orchestratorChatController = require('./orchestratorChatController');

const executeTask = async (req, res) => {
    let { prompt, guardDecision, history = [], chatId = null } = req.body;
    const userId = req.user?._id;

    // STEP 0: Guard Layer Validation
    // Exits immediately if the teammate's Guard Layer deemed it conversational/trivial
    if (guardDecision && guardDecision.response_strategy !== 'ROUTE_TO_SYSTEM') {
        console.log(`[Orchestrator] Bypassed. Guard Layer strategy active: ${guardDecision.response_strategy}`);
        return res.status(200).json({
            success: true,
            bypassed: true,
            message: "Handled by Guard Layer. Orchestrator bypassed successfully."
        });
    }

    if (!prompt) {
        return res.status(400).json({ error: "Prompt payload is heavily required for Orchestration." });
    }

    // Initialize Server-Sent Events (SSE) for transparent stream updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendUpdate = (phase, status, complete, data = null) => {
        const payload = JSON.stringify({ phase, status, complete, data });
        res.write(`data: ${payload}\n\n`);
    };

    let activeChatId = chatId;

    try {
        // STEP -1: Manage Chat Session & Persistence
        if (userId) {
            const chat = await orchestratorChatController.getOrCreateChat(userId, activeChatId, prompt);
            activeChatId = chat._id;
            
            // Note: User message is already saved in the /intent route if called before this,
            // but we might want to check for duplicates if the frontend calls this directly.
            // For now, we assume /intent saved it if it preceded this.
        }
        // STEP 1: Understanding Intent
        sendUpdate('intent', 'Decoding architectural intent from raw block...', false);
        
        // Utilize the static engine rules locally
        const intentResult = orchestratorService.engine.classifyIntent(prompt);
        const docTypeResult = orchestratorService.engine.detectDocType(prompt);
        const riskResult = orchestratorService.engine.detectRisk(prompt);
        
        // Ensure UX perception is realistic
        await new Promise(r => setTimeout(r, 600));

        const consolidatedIntent = {
            ...intentResult,
            docType: docTypeResult.type,
            isHighRisk: riskResult.isHighRisk
        };

        sendUpdate('intent', 'Intent fully mapped safely.', true, consolidatedIntent);

        // STEP 2: Task Breakdown
        sendUpdate('breakdown', 'Deconstructing overarching goal into executable micro-steps...', false);
        
        const tasks = await orchestratorService.breakDownTask(prompt, consolidatedIntent);
        
        sendUpdate('breakdown', 'Task Breakdown Matrix dynamically generated.', true, tasks);

        // STEP 3 & 4: Agent Mapping & Trigger Logic
        sendUpdate('mapping', 'Allocating computational workload to specialized Agent Workforces...', false);
        await new Promise(r => setTimeout(r, 800));

        // Sorting mapping mathematically
        const mappedAgents = {};
        let requiresTimeAgent = false;

        tasks.forEach(task => {
            if (!mappedAgents[task.suggested_agent]) {
                mappedAgents[task.suggested_agent] = [];
            }
            mappedAgents[task.suggested_agent].push(task);
            if (task.is_delayed) requiresTimeAgent = true;
        });

        // Logical Routing Decision
        const routingDecision = requiresTimeAgent 
            ? 'Execution temporally scheduled via Time Agent holding pattern.'
            : 'Immediate autonomous execution triggered via base node Agents.';

        sendUpdate('mapping', routingDecision, true, mappedAgents);

        // STEP 5: Execution Handoff
        sendUpdate('execution', `Handoff initiated to ${tasks[0].suggested_agent}...`, false);
        let executionResult = null;

        try {
            const firstAgent = tasks[0].suggested_agent;
            
            if (firstAgent === 'docs_agent') {
                sendUpdate('execution', 'Docs Agent: Initializing document generation pipeline...', false);
                executionResult = await docsAgentService.generateFullDocument(req.user, {
                    prompt: prompt,
                    history: []
                });
                sendUpdate('execution', 'Docs Agent: Document generation complete.', true);
            } 
            else if (firstAgent === 'communication_agent') {
                sendUpdate('execution', 'Communication Agent: Drafting contextual message...', false);
                executionResult = await communicationService.processMessage(req.user._id, prompt, history);
                sendUpdate('execution', 'Communication Agent: Draft completed.', true);
            }
            else if (firstAgent === 'time_agent') {
                sendUpdate('execution', 'Time Agent: Analyzing temporal constraints and generating schedule...', false);
                // Mock req/res for the controller
                const mockRes = { json: (data) => { executionResult = data; }, status: () => mockRes };
                await timeAgentController.planTask({ body: { prompt }, user: req.user }, mockRes);
                sendUpdate('execution', 'Time Agent: Strategic plan finalized.', true);
            }
        } catch (execError) {
            console.error('[Orchestrator] Execution handoff failed:', execError);
            sendUpdate('execution', `Execution error: ${execError.message}`, true);
        }

        // TRIGGER LEARNING: Analyze the interaction to extract patterns/roles
        const userId = req.user?._id;
        if (userId) {
            // Build full conversation for analysis: history + current prompt + result
            const fullConversation = [
                ...history.map(h => ({ role: h.role, content: h.content })),
                { role: "user", content: prompt },
                ...(executionResult?.message ? [{ role: "assistant", content: executionResult.message }] : [])
            ];
            if (fullConversation.length >= 2) {
                learningService.analyzeInteraction(userId, fullConversation).catch(err => 
                    console.error("[OrchestratorController] Learning Trigger failed:", err)
                );
            }
        }

        // Save Assistant Message
        if (userId && executionResult?.message) {
            await orchestratorChatController.saveMessage(activeChatId, null, executionResult.message);
        }

        // End active execution stream
        sendUpdate('complete', 'Task fulfilled successfully via automated orchestration.', true, { 
            result: executionResult,
            agent: tasks[0].suggested_agent,
            chatId: activeChatId
        });
        res.end();

    } catch (error) {
        console.error('[Orchestrator] Execution Pipeline Critical Error:', error);
        sendUpdate('error', 'Execution sequence aborted due to internal anomaly.', true, { error: error.message });
        res.end();
    }
};

module.exports = {
    executeTask
};
