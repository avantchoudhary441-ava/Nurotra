const intentAnalyzer = require('./agents/intentAnalyzer');
const temporalPlanner = require('./agents/temporalPlanner');
const { getTemporalContext } = require('../utils/timeHelper');
const docsAgentService = require('./docsAgentService');
const NuroMemory = require('../models/NuroMemory');
const Contact = require('../models/Contact');

/**
 * Time Agent Service
 * Pure service layer — no req/res coupling.
 * Can be called from the orchestrator or any other service.
 *
 * @param {string} prompt - The user's natural language task prompt
 * @param {Object} user   - The authenticated user object (must have ._id)
 * @param {Array}  history - Conversation history (optional)
 * @returns {Object} - { success, intent, planning, document, message, coordination }
 */
const planTask = async (prompt, user, history = []) => {
    if (!prompt) {
        return {
            success: false,
            message: 'Task prompt is required for the Time Agent.'
        };
    }

    try {
        // 1. Get current ground truth time
        const temporalContext = getTemporalContext();

        // 1.5 Hardcoded Vagueness Check (Pre-Agent)
        const lowerPrompt = prompt.toLowerCase().trim();
        const words = lowerPrompt.split(/\s+/);
        const isVaguePattern =
            ['report', 'ppt', 'presentation', 'doc', 'document'].some(p => lowerPrompt.includes(p)) &&
            words.length <= 2;

        if (history.length <= 1 && (isVaguePattern || words.length < 2)) {
            const type =
                lowerPrompt.includes('ppt') || lowerPrompt.includes('presentation')
                    ? 'presentation'
                    : 'report';
            return {
                success: true,
                intent: { is_vague: true, clarification_prompt: `What should the ${type} be about?` },
                planning: null,
                message: `What should the ${type} be about? I need a topic to get started.`
            };
        }

        // 2. Fetch Memory Context
        const memory = await NuroMemory.findOne({ userId: user._id }).lean();

        // 3. Relationship context heuristic
        const wordsForPerson = prompt.split(/\s+/);
        let relationshipContext = '';
        for (const word of wordsForPerson) {
            const cleanWord = word.replace(/[^\w]/g, '');
            if (cleanWord.length > 2) {
                const contact = await Contact.findOne({
                    userId: user._id,
                    name: new RegExp('^' + cleanWord + '$', 'i')
                }).lean();
                if (contact && contact.metadata?.relationshipRole) {
                    relationshipContext += `\nHigh-stakes role detected: ${contact.name} is the user's ${contact.metadata.relationshipRole}. `;
                    if (['boss', 'professor', 'teacher', 'client'].includes(
                        contact.metadata.relationshipRole.toLowerCase()
                    )) {
                        relationshipContext += `ENFORCE MAXIMUM PROFESSIONALISM AND BUFFER TIME.`;
                    }
                }
            }
        }

        // 4. Extract Intent
        const intent = await intentAnalyzer.analyzeIntent(
            prompt, history, [], temporalContext, memory, relationshipContext
        );
        console.log(`[TimeAgentService] Deadline: ${intent.deadline} | Docs Req: ${intent.requires_docs}`);

        // 5. Vague / no deadline — ask for clarification
        if (intent.is_vague || !intent.deadline) {
            return {
                success: true,
                intent,
                planning: null,
                document: null,
                message:
                    intent.clarification_prompt ||
                    "I need a specific deadline (e.g., 'by 5pm') to generate a detailed schedule. When do you need this completed?",
                coordination: {
                    agents: intent.agents || ['time'],
                    status: 'waiting_for_input'
                }
            };
        }

        // 6. Optional Docs coordination
        let docResult = null;
        if (intent.requires_docs || (intent.agents && intent.agents.includes('docs'))) {
            console.log(`[TimeAgentService] Coordination Triggered: Starting Docs Agent for topic: ${intent.topic}`);
            try {
                const synthesizedPrompt = intent.topic
                    ? `Create a ${intent.output_format || 'presentation'} about ${intent.topic}. User's latest instruction: ${prompt}`
                    : prompt;

                docResult = await docsAgentService.generateFullDocument(user, {
                    prompt: synthesizedPrompt,
                    history
                });
            } catch (docErr) {
                console.warn('[TimeAgentService] Docs coordination failed:', docErr.message);
            }
        }

        // 7. Fast Track: deadline < 2 minutes
        const deadlineStr = String(intent.deadline || '').toLowerCase();
        const isShortLiteral =
            /\b(10|20|30|40|50|60)\s*(sec|s)\b/.test(deadlineStr) ||
            /\b(1|2)\s*(min|m)\b/.test(deadlineStr);

        let isFastTrack = false;
        if (intent.deadline) {
            const dateVal = new Date(intent.deadline);
            const timeDiff = dateVal.getTime() - Date.now();
            if ((!isNaN(timeDiff) && timeDiff <= 120000) || isShortLiteral) {
                isFastTrack = true;
            }
        }

        if (isFastTrack) {
            console.log('[TimeAgentService] FAST TRACK: Skipping temporal planning for instant execution.');
            return {
                success: true,
                intent,
                planning: {
                    intensity: 'critical',
                    totalPhases: 1,
                    schedule: [{
                        timeLabel: 'Now',
                        title: 'Instant Generation',
                        description: 'System has prioritized your request for immediate delivery.',
                        status: 'completed',
                        targetDay: new Date().getDate()
                    }]
                },
                document: docResult
                    ? { id: docResult.document._id, name: docResult.document.name, type: docResult.type, status: 'ready' }
                    : null,
                message: docResult
                    ? `Priority hand-off complete. Your ${docResult.type} is ready for download.`
                    : 'I have prioritized your request for instant execution.',
                coordination: {
                    agents: intent.agents || ['time'],
                    status: docResult ? 'Document ready, priority delivered' : 'Instant task marked complete'
                }
            };
        }

        // 8. Full Temporal Schedule
        const planning = await temporalPlanner.generateTimeline(
            prompt, intent, temporalContext, memory, relationshipContext
        );
        console.log(`[TimeAgentService] Schedule Generated: ${planning.totalPhases} phases.`);

        return {
            success: true,
            intent,
            planning,
            document: null,
            scheduledDocument: docResult
                ? { id: docResult.document._id, name: docResult.document.name, type: docResult.type, deliverAt: intent.deadline }
                : null,
            coordination: {
                agents: intent.agents || ['time'],
                status: docResult ? 'Document ready, waiting for temporal deadline' : 'Standalone temporal plan'
            },
            message: docResult
                ? `Time Agent has planned your strategy. Your ${docResult.type} will be delivered at the deadline.`
                : `Time Agent has planned your execution strategy based on the ${intent.deadline || 'requested'} deadline.`,
            userTodos: planning.user_todos || []
        };

    } catch (error) {
        console.error('[TimeAgentService] Planning failed:', error);
        return {
            success: false,
            message: 'Time Agent planning failed: ' + error.message
        };
    }
};

module.exports = { planTask };
