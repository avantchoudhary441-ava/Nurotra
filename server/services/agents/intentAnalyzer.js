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
        You MUST use the [CONVERSATION HISTORY] to resolve context. If the user provided a topic or deadline in previous turns, do NOT mark the request as is_vague.
        
        [TEMPORAL CONTEXT]:
        ${temporalContext || "No specific temporal context provided."}
        
        Fields:
        - topic: The main subject. (Inherit from history if already discussed)
        - audience: Who is this for?
        - purpose: education, pitch, report, marketing, storytelling.
        - tone: professional, formal, minimal, creative.
        - content_density: visual_heavy, balanced, text_heavy.
        - complexity: beginner, intermediate, expert.
        - slides: estimated number (default 7).
        - output_format: ppt, website, report, doc.
        - deadline: Any specific time reference. Use the history to resolve relative dates like "today".
        - urgency: low, medium, high, critical.
        - requires_docs: true if the user asks to create/generate a document.
        - agents: Array of agents needed. Possible: ["time", "docs"].
        - is_vague: true ONLY if both history and current prompt lack clear goal/deadline. 
        - clarification_prompt: A concise question to ask if information is missing.

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
