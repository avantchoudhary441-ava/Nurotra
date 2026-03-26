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

        You are the Nurotra Intent Analyzer. Your goal is to extract structured scheduling intent from the user.
        
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
        
        Fields Mapping:
        - topic: Highly specific subject (extract from history if needed).
        - deadline: Specific time/date. Resolve relative terms (e.g., "today") using [TEMPORAL CONTEXT].
        - requires_docs: true if any mention of creating/writing/generating files/slides/reports.
        - agents: ["time"] always, add "docs" if requires_docs is true.
        - is_vague: true ONLY if the combined history and prompt cannot provide a Topic AND a Deadline.
        - clarification_prompt: The specific question to fill the gap. null if is_vague is false.

        Output STRICT JSON:
        {
          "topic": "...", "audience": "...", "purpose": "...", "tone": "...",
          "content_density": "...", "complexity": "...", "slides": 7, "output_format": "ppt",
          "deadline": "...", "urgency": "...", "requires_docs": false, "agents": ["time"],
          "is_vague": false, "clarification_prompt": null
        }
    `;

    try {
        let text = await aiService.generateWithFallback(prompt, systemPrompt, [], multimediaContext);
        // Clean JSON
        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("[Agent 1] Intent Analysis failed:", error.message);
        throw error;
    }
};

module.exports = { analyzeIntent };
