/**
 * Agent 2 — Classification Agent
 * Classifies the document type based on the analyzed intent.
 */
const aiService = require("../aiService");

const classifyType = async (prompt, intentData, multimediaContext = [], temporalContext = "") => {
    const systemPrompt = `
        You are the Nurotra Classifier. 
        Based on the user prompt and the extracted intent, classify the presentation/document type.
        CONSULT attached PDF files if available to understand the complexity and nature of the source.
        
        [TEMPORAL CONTEXT]:
        ${temporalContext || "No specific temporal context provided."}
        
        Possible types:
        - startup_pitch
        - educational_presentation
        - technical_report
        - research_presentation
        - product_marketing
        - case_study
        - storytelling
        - general_business
 
        Output STRICT JSON:
        {
          "presentation_type": "..."
        }
    `;

    const extendedPrompt = `Original Prompt: ${prompt}\nIntent Data: ${JSON.stringify(intentData)}`;

    try {
        let text = await aiService.generateWithFallback(extendedPrompt, systemPrompt, [], multimediaContext);
        text = text.replace(/```json|```/g, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("[Agent 2] Classification failed:", error.message);
        throw error;
    }
};

module.exports = { classifyType };
