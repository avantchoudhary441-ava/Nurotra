const orchestratorService = require('../services/orchestratorService');
const learningService = require('../services/learningService');
const docsAgentService = require('../services/docsAgentService');
const communicationService = require('../services/communicationService');
const actionAgentService = require('../services/actionAgentService');
const timeAgentService = require('../services/timeAgentService');
const NuroMemory = require('../models/NuroMemory');
const orchestratorChatController = require('./orchestratorChatController');

/**
 * Strips Mongoose documents and non-serializable objects into plain JSON.
 * This prevents the SSE stream from breaking when result objects contain
 * circular references or Mongoose model instances.
 */
const sanitizeResult = (result) => {
    if (!result) return null;
    try {
        // Mongoose documents have toObject(); plain objects pass through
        const r = typeof result.toObject === 'function' ? result.toObject() : result;
        return {
            success: r.success ?? true,
            message: r.message || '',
            intent:  r.intent  || null,
            workflow: r.workflow ? {
                title:   r.workflow.title,
                actions: (r.workflow.actions || []).map(a => ({
                    id:    a.id,
                    label: a.label,
                    icon:  a.icon
                }))
            } : null,
            planning: r.planning ? {
                intensity:   r.planning.intensity,
                totalPhases: r.planning.totalPhases,
                schedule:    (r.planning.schedule || []).slice(0, 6)
            } : null,
            document: r.document ? {
                _id:  r.document._id?.toString(),
                name: r.document.name,
                type: r.document.type
            } : null,
            fileName:  r.fileName  || null,
            needs_clarification: r.needs_clarification || false
        };
    } catch (e) {
        console.error('[Orchestrator] sanitizeResult failed:', e.message);
        return { success: false, message: 'Result serialization error.' };
    }
};

/**
 * Build a human-readable summary string from the agent results.
 */
const buildSummaryMessage = (agentResults) => {
    if (!agentResults || agentResults.length === 0) return 'Task processing complete.';
    const lines = agentResults.map(r => {
        const label = r.agent.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (r.error) return `**${label}**: ⚠ ${r.error}`;
        const res = r.result;
        if (res?.document?.name) return `**${label}**: ✅ Document ready — *${res.document.name}*`;
        if (res?.workflow?.title)  return `**${label}**: ✅ Workflow — *${res.workflow.title}*`;
        if (res?.planning)         return `**${label}**: ✅ Schedule generated (${res.planning.totalPhases} phases)`;
        if (res?.message)          return `**${label}**: ✅ ${res.message.slice(0, 120)}`;
        return `**${label}**: ✅ Complete`;
    });
    return lines.join('\n\n');
};

/**
 * Orchestrator Execute — Multi-Agent Coordination Loop
 * POST /api/orchestrator/execute
 *
 * Streams SSE updates as it:
 *   1. Classifies intent
 *   2. Breaks task into sub-tasks via LLM
 *   3. Maps sub-tasks to agents
 *   4. Dispatches EVERY sub-task to the correct agent sequentially
 *   5. Collects all results and emits a 'complete' event
 */
const executeTask = async (req, res) => {
    let { prompt, guardDecision, history = [], chatId = null } = req.body;
    const userId = req.user?._id;

    // STEP 0: Guard Layer Validation
    if (guardDecision && guardDecision.response_strategy !== 'ROUTE_TO_SYSTEM') {
        console.log(`[Orchestrator] Bypassed. Guard Layer strategy: ${guardDecision.response_strategy}`);
        return res.status(200).json({
            success: true,
            bypassed: true,
            message: 'Handled by Guard Layer. Orchestrator bypassed successfully.'
        });
    }

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt payload is required for Orchestration.' });
    }

    // Initialize SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendUpdate = (phase, status, complete, data = null) => {
        const payload = JSON.stringify({ phase, status, complete, data });
        res.write(`data: ${payload}\n\n`);
    };

    let activeChatId = chatId;

    try {
        // ── Chat Session Management ──────────────────────────────────────────
        if (userId) {
            const chat = await orchestratorChatController.getOrCreateChat(userId, activeChatId, prompt);
            activeChatId = chat._id;
        }

        // ── STEP 1: Intent Classification ────────────────────────────────────
        sendUpdate('intent', 'Decoding intent from user prompt...', false);

        const intentResult = orchestratorService.engine.classifyIntent(prompt);
        const docTypeResult = orchestratorService.engine.detectDocType(prompt);
        const riskResult = orchestratorService.engine.detectRisk(prompt);

        await new Promise(r => setTimeout(r, 500));

        const consolidatedIntent = {
            ...intentResult,
            docType: docTypeResult.type,
            isHighRisk: riskResult.isHighRisk
        };

        sendUpdate('intent', 'Intent fully mapped.', true, consolidatedIntent);

        // ── STEP 2: Task Breakdown via LLM ───────────────────────────────────
        sendUpdate('breakdown', 'Deconstructing goal into executable sub-tasks...', false);

        const tasks = await orchestratorService.breakDownTask(prompt, consolidatedIntent);

        sendUpdate('breakdown', `${tasks.length} sub-task(s) identified.`, true, tasks);

        // ── STEP 3: Agent Mapping ─────────────────────────────────────────────
        sendUpdate('mapping', 'Allocating sub-tasks to specialized Agent Workforces...', false);
        await new Promise(r => setTimeout(r, 600));

        const mappedAgents = {};
        let requiresTimeAgent = false;

        tasks.forEach(task => {
            if (!mappedAgents[task.suggested_agent]) {
                mappedAgents[task.suggested_agent] = [];
            }
            mappedAgents[task.suggested_agent].push(task);
            if (task.is_delayed) requiresTimeAgent = true;
        });

        const routingDecision = requiresTimeAgent
            ? 'Execution temporally scheduled via Time Agent.'
            : 'Immediate execution triggered across base Agents.';

        sendUpdate('mapping', routingDecision, true, mappedAgents);

        // ── STEP 4: Multi-Agent Sequential Execution ─────────────────────────
        const agentResults = [];

        // Fetch user memory once (shared across agents that need it)
        let userMemory = null;
        try {
            if (userId) {
                userMemory = await NuroMemory.findOne({ userId }).lean();
            }
        } catch (memErr) {
            console.warn('[Orchestrator] Memory fetch failed:', memErr.message);
        }

        const history = await orchestratorChatController.getHistory(activeChatId);
        let currentExecutionHistory = [...history];

        for (const task of tasks) {
            const agentKey = task.suggested_agent;
            const taskPrompt = task.description || prompt;

            sendUpdate(
                'execution',
                `[${agentKey}] Initiating: "${task.action}"...`,
                false,
                { agent: agentKey, task }
            );

            let result = null;
            let taskError = null;

            try {
                // ── Docs Agent ────────────────────────────────────────────────
                // Always use the MAIN user prompt for docs_agent; the task
                // description is a workflow label, not a document brief.
                if (agentKey === 'docs_agent') {
                    result = await docsAgentService.generateFullDocument(req.user, {
                        prompt: prompt,
                        history: []
                    });
                }

                // ── Action Agent ──────────────────────────────────────────────
                else if (agentKey === 'action_agent') {
                    result = await actionAgentService.parseActionIntent(
                        taskPrompt,
                        userMemory,
                        history
                    );
                }

                // ── Time Agent ────────────────────────────────────────────────
                else if (agentKey === 'time_agent') {
                    result = await timeAgentService.planTask(taskPrompt, req.user, history);
                }

                // ── Communication Agent ───────────────────────────────────────
                else if (agentKey === 'communication_agent') {
                    result = await communicationService.processMessage(
                        userId,
                        taskPrompt,
                        currentExecutionHistory
                    );
                }

                // ── Unknown Agent — graceful fallback ─────────────────────────
                else {
                    console.warn(`[Orchestrator] Unknown agent type: ${agentKey}`);
                    result = {
                        success: false,
                        message: `No handler registered for agent: ${agentKey}`
                    };
                }

            } catch (execError) {
                console.error(`[Orchestrator] ${agentKey} execution failed:`, execError);
                taskError = execError.message;
                result = { success: false, message: execError.message };
            }

            const sanitized = sanitizeResult(result);
            agentResults.push({ agent: agentKey, task, result: sanitized, error: taskError });

            // Feed this result back into the execution history for the next agent in the loop
            currentExecutionHistory.push({
                role: 'system',
                content: `Agent [${agentKey}] completed task: "${task.action}". Result: ${JSON.stringify(sanitized)}`
            });

            sendUpdate(
                'execution',
                taskError
                    ? `[${agentKey}] ⚠ "${task.action}" encountered an error.`
                    : `[${agentKey}] ✓ "${task.action}" complete.`,
                true,
                { agent: agentKey, result: sanitized }
            );
        }

        // ── STEP 5: Learning Trigger ──────────────────────────────────────────
        if (userId) {
            const primaryResult = agentResults[0]?.result;
            const fullConversation = [
                ...history.map(h => ({ role: h.role, content: h.content })),
                { role: 'user', content: prompt },
                ...(primaryResult?.message
                    ? [{ role: 'assistant', content: primaryResult.message }]
                    : [])
            ];
            if (fullConversation.length >= 2) {
                learningService
                    .analyzeInteraction(userId, fullConversation)
                    .catch(err => console.error('[Orchestrator] Learning trigger failed:', err));
            }
        }

        // ── STEP 6: Build summary & save to chat ─────────────────────────────
        const summaryMessage = buildSummaryMessage(agentResults);
        if (userId) {
            try {
                await orchestratorChatController.saveMessage(activeChatId, null, summaryMessage);
            } catch (saveErr) {
                console.warn('[Orchestrator] Failed to save summary message:', saveErr.message);
            }
        }

        // ── STEP 7: Complete (sanitized, plain-JSON payload) ──────────────────
        const primaryResult = agentResults[0]?.result || null;
        sendUpdate('complete', summaryMessage, true, {
            results:    agentResults,   // already sanitized
            result:     primaryResult,  // legacy compat
            agent:      agentResults[0]?.agent,
            chatId:     activeChatId,
            summary:    summaryMessage
        });

        res.end();

    } catch (error) {
        console.error('[Orchestrator] Critical Pipeline Error:', error);
        sendUpdate('error', 'Execution aborted due to internal error.', true, { error: error.message });
        res.end();
    }
};

module.exports = { executeTask };
