/**
 * Agent 1 — Intent Analyzer
 * Extracts structured fields from natural language prompts.
 */
const aiService = require("../aiService");

const analyzeIntent = async (prompt, history = [], multimediaContext = [], temporalContext = "") => {
    // Format history for the LLM
    const historyString = Array.isArray(history)
        ? history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text || m.content}`).join("\n")
        : "No previous history.";

    const systemPrompt = `
        [CONVERSATION HISTORY]:
        ${historyString}

        You are the Nurotra Intent Analyzer. Extract structured information from the user prompt into JSON.
        
        [CRITICAL: CONTEXTUAL INHERITANCE]:
        1. Access the [CONVERSATION HISTORY] to identify the current objective.
        2. If a [TOPIC] was established in previous turns (e.g., "space", "AI trends"), you MUST use it for the current turn if the user is refining the same task.
        3. If [requires_docs] was true previously (e.g., user asked for a "report" or "ppt"), it MUST stay true during refinements/deadline updates.
        4. Persist the [output_format] (e.g., "report", "ppt") from the history unless the user explicitly changes it.
        5. Persist the [DEADLINE] from the history. If the user previously specified a deadline (e.g. "in 10 sec", "by 5pm"), you MUST include it in the 'deadline' field now, even if the user's latest message doesn't repeat it. This is CRITICAL.
        
        CRITICAL RULES:
        1. Contextual Awareness: Check [CONVERSATION HISTORY] first. If a topic or deadline was mentioned earlier, USE IT. Do not ask for it again.
        2. Minimal Friction: If the user provides a topic and a deadline in the current prompt (e.g., "Report on X by 5pm"), is_vague MUST be false.
        3. Targeted Clarification: If is_vague is true, the clarification_prompt must ONLY ask for the specific missing pieces.
           - If topic is missing: "What is the subject of the task?"
           - If deadline is missing: "When do you need this completed by?"
           - If both are missing: "What do you need to do and by when?"
        4. Implicit Inference: If the user mentions "slides" or "ppt", output_format is "pptx". If they mention "spreadsheet" or "excel", it is "xlsx". If they mention "document", "word", or "file", it is "docx".
        
        [TEMPORAL CONTEXT]:
        ${temporalContext || "No specific temporal context provided."}
        
        Fields:
        - topic: The main subject. (Inherit from history if not mentioned in prompt)
        - audience: Who is this for?
        - purpose: education, pitch, report, marketing, storytelling.
        - tone: professional, formal, minimal, creative.
        - content_density: visual_heavy, balanced, text_heavy.
        - complexity: beginner, intermediate, expert.
        - slides: estimated number (default 7).
        - output_format: ppt, website, report, doc. (Inherit from history)
        - deadline: Any specific time reference. If missing in prompt, check history. If still missing, set to null.
        - urgency: low, medium, high, critical. 
        - requires_docs: true if the user asks (or previously asked) to create/generate a document.
        - is_revision: true if the user is asking to change, fix, or evaluate a document already generated in the [CONVERSATION HISTORY].
        - agents: Array of agents needed. Possible: ["time", "docs"].
        - is_vague: true if history AND current prompt lack a clear [TOPIC] OR a clear [DEADLINE].
        - clarification_prompt: A concise question to ask for the MISSING information.

        [STRICTNESS GUIDELINE]:
        - If the user says "change slide 2" or "fix the title", set is_revision: true.
        - If you have a topic from history but no deadline, is_vague: true, clarification_prompt: "When do you need this completed? Also, could you provide 1-2 specific details or sub-topics about '[TOPIC]' you'd like me to focus on in the [output_format]?"
        - If you have a deadline but no topic in history/prompt, is_vague: true, clarification_prompt: "What should the task be about?"

        
        Output STRICT JSON:
        {
          "topic": "...", "audience": "...", "purpose": "...", "tone": "...",
          "content_density": "...", "complexity": "...", "slides": 7, "output_format": "ppt",
          "deadline": null, "urgency": "...", "requires_docs": false, "is_revision": false, 
          "agents": ["time"], "is_vague": false, "clarification_prompt": null
        }
    `;

    try {
        let text = await aiService.generateWithFallback(prompt, systemPrompt, [], multimediaContext);
        // Clean JSON
        text = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(text);

        // Heuristic fallback for missing topic OR missing deadline
        const lowerPrompt = prompt.toLowerCase().trim();
        
        // 1. Check if history already contains a deadline to avoid looping
        const historyHasDeadline = Array.isArray(history) && history.some(m => {
            const hText = (m.text || m.content || "").toLowerCase();
            return /\bin\s+\d+\s*(sec|min|hour|day)|\bat\s+\d+|\bby\s+\d+|[0-9]{1,2}\s*(am|pm)/i.test(hText);
        });

        // 2. If it's a very short prompt and lacks either critical piece, it's vague
        if (!parsed.topic || parsed.topic.toLowerCase() === 'report' || parsed.topic.toLowerCase() === 'presentation') {
            parsed.is_vague = true;
            parsed.clarification_prompt = parsed.clarification_prompt || "What should the task be about?";
        } else if ((!parsed.deadline || parsed.deadline === 'null' || parsed.deadline === 'not specified') && !historyHasDeadline) {
            // Topic is present, but deadline is missing AND NOT IN HISTORY -> Ask for deadline + sub-questions
            parsed.is_vague = true;
            parsed.clarification_prompt = parsed.clarification_prompt || `When do you need this completed? Also, to make sure the ${parsed.output_format || 'document'} is highly relevant, could you share 1-2 specific details or sub-topics about '${parsed.topic}' you'd like included?`;
            parsed.deadline = null; // Normalize
        } else if (historyHasDeadline && (!parsed.deadline || parsed.deadline === 'null')) {
            // If history has it but LLM missed it, we allow non-vague if topic is solid
            parsed.is_vague = false;
        }

        return parsed;
    } catch (error) {
        console.error("[Agent 1] Intent Analysis failed:", error.message);
        throw error;
    }
};

module.exports = { analyzeIntent };
