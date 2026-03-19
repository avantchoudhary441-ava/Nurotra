/**
 * Agent 1 — Intent Analyzer
 * Extracts structured fields from natural language prompts.
 */
const aiService = require("../aiService");

const analyzeIntent = async (prompt, sourceContent = "", multimediaContext = []) => {
    const systemPrompt = `
        [SOURCE MATERIAL]:
        ${(sourceContent && typeof sourceContent === 'string') ? sourceContent.substring(0, 5000) : "No source provided."}

        You are the Nurotra Intent Analyzer. Extract structured information from the user prompt into JSON.
        You MUST prioritize the [SOURCE MATERIAL] above for topic, audience, and purpose.
        
        Fields:
        - topic: The main subject.
        - audience: Who is this for?
        - purpose: education, pitch, report, marketing, storytelling.
        - tone: professional, formal, minimal, creative.
        - content_density: visual_heavy, balanced, text_heavy.
        - complexity: beginner, intermediate, expert.
        - slides: estimated number (default 7).
        - output_format: ppt, website, report.

        Output STRICT JSON:
        {
          "topic": "...", "audience": "...", "purpose": "...", "tone": "...",
          "content_density": "...", "complexity": "...", "slides": 7, "output_format": "ppt"
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
