/**
 * Agent 1 — Intent Analyzer
 * Extracts structured fields from natural language prompts.
 */
const aiService = require("../aiService");

const analyzeIntent = async (prompt, sourceContent = "", multimediaContext = [], temporalContext = "") => {
    const systemPrompt = `
        [SOURCE MATERIAL]:
        ${(sourceContent && typeof sourceContent === 'string') ? sourceContent.substring(0, 5000) : "No source provided."}

        You are the Nurotra Intent Analyzer. Extract structured information from the user prompt into JSON.
        You MUST prioritize the [SOURCE MATERIAL] above for topic, audience, and purpose.
        
        [TEMPORAL CONTEXT]:
        ${temporalContext || "No specific temporal context provided."}
        
        Fields:
        - topic: The main subject.
        - audience: Who is this for?
        - purpose: education, pitch, report, marketing, storytelling.
        - tone: professional, formal, minimal, creative.
        - content_density: visual_heavy, balanced, text_heavy.
        - complexity: beginner, intermediate, expert.
        - slides: estimated number (default 7).
        - output_format: ppt, website, report.
        - deadline: Any specific time reference (e.g., "tomorrow", "Friday", "2 hours", "ISO-8601 string"). Default: null.
        - urgency: low, medium, high, critical.
        - requires_docs: true if the user explicitly asks to create/generate a document, ppt, or report.
        - agents: Array of agents needed. Possible: ["time", "docs"].

        Output STRICT JSON:
        {
          "topic": "...", "audience": "...", "purpose": "...", "tone": "...",
          "content_density": "...", "complexity": "...", "slides": 7, "output_format": "ppt",
          "deadline": "...", "urgency": "...", "requires_docs": false, "agents": ["time"]
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
