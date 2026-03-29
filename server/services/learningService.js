const OpenAI = require("openai");
const NuroMemory = require("../models/NuroMemory");
const Contact = require("../models/Contact");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * The Learning Engine: Extracts entities, roles, and patterns from interactions.
 */
async function analyzeInteraction(userId, conversationHistory) {
    console.log(`[LearningService] Analyzing interaction for user ${userId}...`);
    if (!conversationHistory || conversationHistory.length < 2) {
        console.warn("[LearningService] History too short to analyze.");
        return;
    }

    try {
        const historyText = conversationHistory
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join("\n");

        const prompt = `Analyze the following AI-Human interaction for Nurotra's Learning Memory system.
        
IDENTIFY:
1. ENTITIES: People mentioned (Name, Role). Roles include Boss, Professor, Teacher, Colleague, Friend, Client, Stakeholder.
2. TRAITS: Behavioral patterns of the User (e.g. "Deadline Stress", "Prefers Formal Tone", "Fast Responder").
3. MISSION: Any long-term goals or plans the user mentioned (e.g. "I want to graduate by May", "Building a marketing agency").

CONVERSATION HISTORY:
${historyText}

OUTPUT JSON ONLY:
{
  "entities": [{"name": "string", "role": "string", "context": "string"}],
  "traits": [{"trait": "string", "confidence": 0-100}],
  "mission": "updated mission statement if detected",
  "goals": ["extracted active goals"]
}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: prompt }],
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(response.choices[0].message.content);
        
        // 1. Update NuroMemory
        let memory = await NuroMemory.findOne({ userId });
        if (!memory) {
            memory = new NuroMemory({ userId });
        }

        // Update traits
        if (analysis.traits && analysis.traits.length > 0) {
            analysis.traits.forEach(t => {
                const existing = memory.behavioralPatterns.find(p => p.trait.toLowerCase() === t.trait.toLowerCase());
                if (existing) {
                    existing.confidence = Math.min(100, existing.confidence + 10);
                    existing.lastDetected = new Date();
                } else {
                    memory.behavioralPatterns.push({
                        trait: t.trait,
                        confidence: t.confidence || 50,
                        firstDetected: new Date(),
                        lastDetected: new Date()
                    });
                }
            });
        }

        // Update mission/goals
        if (analysis.mission) {
            memory.longTermPlan.mission = analysis.mission;
            memory.longTermPlan.lastUpdated = new Date();
        }
        
        if (analysis.goals && analysis.goals.length > 0) {
            analysis.goals.forEach(g => {
                if (!memory.longTermPlan.activeGoals.includes(g)) {
                    memory.longTermPlan.activeGoals.push(g);
                }
            });
            memory.longTermPlan.lastUpdated = new Date();
        }

        await memory.save();

        // 2. Update Contacts
        if (analysis.entities && analysis.entities.length > 0) {
            for (const entity of analysis.entities) {
                if (entity.name && entity.role) {
                    // Try to find contact by name (case-insensitive)
                    // We also look for the name in the relationshipRole/context to see if it's already there
                    await Contact.findOneAndUpdate(
                        { userId, name: new RegExp('^' + entity.name + '$', 'i') },
                        { 
                            $set: { 
                                "metadata.relationshipRole": entity.role,
                                "metadata.relationshipContext": entity.context || ""
                            } 
                        }
                    );
                }
            }
        }

        console.log(`[LearningService] Analysis complete. Detected ${analysis.entities?.length || 0} entities and ${analysis.traits?.length || 0} traits.`);
        return analysis;
    } catch (error) {
        console.error("[LearningService] Error during analysis:", error.message);
    }
}

module.exports = { analyzeInteraction };
