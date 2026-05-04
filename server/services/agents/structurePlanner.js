/**
 * Agent 3 — Structure Planner
 * Generates a dynamic slide/section structure based on the document type.
 */
const aiService = require("../aiService");

const generateStructure = async (prompt, intentData, classificationData, sourceContent = "", multimediaContext = [], temporalContext = "") => {
  const systemPrompt = `
        You are the Nurotra Structure Planner. 
        Based on the User Intent and Classification provided, you must plan the structure of the document (Word, PPT, or Excel).
        
        [SOURCE CONTENT]: 
        ${sourceContent || 'None'}

        [TEMPORAL CONTEXT]:
        ${temporalContext || "No specific temporal context provided."}

        CRITICAL MISSION: You are a professional researcher. You MUST consult the attached PDF files to find the REAL name of the novel, the ACTUAL names of all characters, and the REAL plot details.
        
        STRICT RULES:
        1. NO BRACKETS: Never output titles like "[Novel Name]" or "Analysis of [Character]". Use the actual names from the book.
        2. NO GENERIC TITLES: Do not use "Introduction", "Character List", or "Synopsis". Use specific titles like "The Fate of Arjun in Meerut", "Riya's Ambitions and Sacrifices", etc.
        3. HIGH VOLUME: The user wants a "7-page" document. You MUST generate at least 15-20 distinct, detailed sections to support this length.
        
        [USER PROMPT]:
        ${prompt}
        
        Respond ONLY with a JSON object containing a "sections" array.
        Example: { "sections": [{ "title": "Arjun's Early Struggles in the Novel", "objective": "Detail his background and arrival..." }] }
    `;

  const extendedPrompt = `
        Original Prompt: ${prompt}
        Intent Data: ${JSON.stringify(intentData)}
        Classification: ${JSON.stringify(classificationData)}
    `;

  try {
    let text = await aiService.generateWithFallback(extendedPrompt, systemPrompt, [], multimediaContext);

    // Cleanup and repair
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    } else {
      text = text.replace(/```json|```/g, "").trim();
    }

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.warn("[Agent 3] JSON Parse Failed. Attempting repair...");
      if (text.endsWith('...') || text.includes('sections')) {
        try {
          let repaired = text;
          if (!repaired.endsWith(']}')) repaired += ']}';
          if (!repaired.endsWith('}')) repaired += '\}';
          return JSON.parse(repaired);
        } catch (e) {
          console.error("[Agent 3] Repair failed:", e.message);
        }
      }
      throw parseErr;
    }
  } catch (error) {
    console.error("[Agent 3] Structure Planning failed:", error.message);
    throw error;
  }
};

module.exports = { generateStructure };
