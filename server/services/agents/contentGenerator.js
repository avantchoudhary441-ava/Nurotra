/**
 * Agent 5 — Content Generator
 * Generates high-fidelity structured content for slides/sections.
 */
const aiService = require("../aiService");

const generateContent = async (prompt, intentData, structureData, sourceContent = "", multimediaContext = []) => {
  const systemPrompt = `
        [SOURCE MATERIAL]:
        [SOURCE MATERIAL]:
        ${(sourceContent && typeof sourceContent === 'string') ? sourceContent.substring(0, 100000) : 'No external source provided.'}

        You are the Nurotra Content Engine. Your life depends on being 100% accurate to the attached PDF files.
        
        STRICT GROUNDING RULES:
        1. NO BRACKETS: Never output text like "[Novel Name]", "[Character]", or "[Author]". If you don't know a name, FIND IT in the PDF.
        2. NO PLACEHOLDERS: NEVER use generic text like "Character A", "The protagonist", or "A brief description". You MUST use the actual names from the book (e.g., "Arjun", "Riya").
        3. REAL DATA ONLY: Extract real plot points, specific quotes, and unique character traits from the attached files. 
        4. MAXIMUM DEPTH: The user wants a "7-page" manuscript. Each section must be at least 4-5 paragraphs of dense, polished prose. do not use short bullet points unless explicitly requested.
        
        Output Strictly JSON containing a "slides" array.
        
        Schema:
        {
          "slides": [
            {
              "title": "Actual Specific Section Title",
              "bullets": ["Multi-sentence paragraph 1 detailing plot point X...", "Multi-sentence paragraph 2 detailing character motive Y...", "Deep analysis paragraph 3..."],
              "image_query": "specific search term for visuals",
              "icon_key": "lucide_icon_name"
            }
          ]
        }
    `;

  const extendedPrompt = `
        Generate the content for the sections defined in the Structure below.
        
        User Goal: ${prompt}
        Intent: ${JSON.stringify(intentData)}
        Structure: ${JSON.stringify(structureData)}
    `;

  try {
    let text = await aiService.generateWithFallback(extendedPrompt, systemPrompt, [], multimediaContext);
    
    // Cleanup and robust parsing
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        text = jsonMatch[0];
    } else {
        text = text.replace(/```json|```/g, "").trim();
    }

    try {
        return JSON.parse(text);
    } catch (parseErr) {
        console.error("[Agent 5] JSON Parse Failed. Raw text sample:", text.substring(0, 500));
        // Try to close unclosed braces if truncated
        if (text.endsWith('...') || text.length > 5000) {
            try {
                // Extremly simple repair for truncated JSON array/objects
                let repaired = text;
                if (!repaired.endsWith('}')) repaired += '}]}';
                return JSON.parse(repaired);
            } catch (e) {
                throw new Error("Truncated content received from AI.");
            }
        }
        throw parseErr;
    }
  } catch (error) {
    console.error("[Agent 5] Content Generation failed:", error.message);
    throw error;
  }
};

module.exports = { generateContent };
