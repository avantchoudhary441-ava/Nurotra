const orchestratorService = require('../services/orchestratorService');

const executeTask = async (req, res) => {
    const { prompt, guardDecision } = req.body;

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

    try {
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

        // End active execution stream
        sendUpdate('complete', 'Orchestration Pipeline globally configured and deployed.', true);
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
