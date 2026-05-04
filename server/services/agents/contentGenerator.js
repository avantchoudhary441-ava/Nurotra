/**
 * Agent 5 — Content Generator
 * Generates high-fidelity structured content for slides/sections.
 */
const aiService = require("../aiService");

const generateContent = async (prompt, intentData, structureData, sourceContent = "", multimediaContext = []) => {
  // If structure is large, use parallel chunking for 3x speed
  if (structureData.sections && structureData.sections.length > 3) {
    return generateContentInParallel(prompt, intentData, structureData, sourceContent, multimediaContext);
  }

  const systemPrompt = `
        You are the Nurotra **Content Architect** (Docs Agent), a high-performance professional within an autonomous workforce.
        Your role is to transform raw research, data, and user goals into EXECUTIVE-GRADE professional assets.

        [SOURCE MATERIAL]:
        ${(sourceContent && typeof sourceContent === 'string') ? sourceContent.substring(0, 100000) : 'No external source provided.'}

        TEAM PROTOCOL:
        1. You are part of a coordinated orchestra. 
        2. If [SOURCE MATERIAL] contains research from other agents (Action Agent, etc.), you MUST integrate it architecturally.
        3. Your tone is respectful, direct, and authoritative. 
        4. Focus on structure, clarity, and maximum depth.
        
        STRICT GROUNDING RULES:
        1. NO BRACKETS: Never output text like "[Novel Name]", "[Character]". Find it in the SOURCE.
        2. NO PLACEHOLDERS: Never use generic text like "The protagonist". Use actual names.
        3. REAL DATA ONLY: Extract real insights and unique traits from the files. 
        4. MAXIMUM DEPTH: Each section must be at least 4-5 paragraphs of dense, polished prose.
        
        Output Strictly JSON containing a "slides" array.
        
        Schema:
        {
          "slides": [
            {
              "title": "Actual Specific Section Title",
              "bullets": ["Multi-sentence paragraph 1...", "Multi-sentence paragraph 2...", "Analysis paragraph 3..."],
              "image_query": "visual search term",
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
const generateContentInParallel = async (prompt, intentData, structureData, sourceContent = "", multimediaContext = []) => {
  console.log(`[Agent 5] Initiating Parallel Generation for ${structureData.sections.length} sections...`);
  const chunks = [];
  for (let i = 0; i < structureData.sections.length; i += 3) {
    chunks.push(structureData.sections.slice(i, i + 3));
  }
  const tasks = chunks.map(async (chunk, index) => {
    const chunkStructure = { ...structureData, sections: chunk };
    const systemPrompt = `Draft PART ${index + 1}. Only for provided sections. Output JSON { "slides": [...] }`;
    return JSON.parse((await aiService.generateWithFallback(`Goal: ${prompt}\nStructure: ${JSON.stringify(chunkStructure)}`, systemPrompt, [], multimediaContext, { model: "gpt-4o-mini" })).match(/\{[\s\S]*\}/)[0]);
  });
  const results = await Promise.all(tasks);
  return { slides: results.flatMap(r => r.slides || []) };
};

module.exports = { generateContent, generateContentInParallel };
