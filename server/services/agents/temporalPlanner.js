/**
 * Agent 8 — Temporal Planner
 * Decomposes a goal into a time-scaled execution schedule based on a deadline.
 */
const aiService = require("../aiService");

/**
 * Generates a temporal schedule for a given goal and deadline.
 * @param {string} prompt - Original user goal.
 * @param {object} intentData - Extracted intent (topic, purpose, deadline, urgency).
 * @param {string} temporalContext - Current ground truth time context.
 * @param {object} userMemory - User traits and patterns.
 * @param {string} relationshipContext - Context about roles like Boss/Professor.
 */
const generateTimeline = async (prompt, intentData, temporalContext, userMemory = null, relationshipContext = "") => {
    // Contextual Injection
    const memorySnippet = userMemory ? `
    [USER PATTERNS]: ${userMemory.behavioralPatterns?.map(p => p.trait).join(", ")}
    [LONG-TERM PLAN]: ${userMemory.longTermPlan?.mission}
    [RELATIONSHIP CONTEXT]: ${relationshipContext}
    ` : "";
    const systemPrompt = `
        You are the Nurotra Temporal Planner. 
        Your mission is to take a user goal and a deadline and generate a realistic, time-scaled execution schedule.
        
        [GROUND TRUTH TIME]:
        ${temporalContext}

        ${memorySnippet}

        [USER INTENT]:
        ${JSON.stringify(intentData)}

        STRATEGY:
        1. Calculate the duration between "Current Time" and the "Deadline".
        2. If the duration is < 24 hours: Use HOURLY time buckets.
        3. If the duration is > 24 hours: Use DAILY time buckets.
        4. SCALE INTENSITY:
           - "Critical/High Urgency": High density of tasks, parallel phases.
           - "Low Urgency": Sequential, detailed phases.
        5. ROLE ADAPTATION:
           - If [RELATIONSHIP CONTEXT] indicates a Boss, Professor, or High-Stakes partner: 
             MANDATORY "Final Review & Polish" phase before the deadline. 
             Ensure the user-todos reflect high-quality verification.
        
        RULES:
        1. Output a "schedule" array of objects.
        2. Each object MUST have: "timeLabel" (e.g., "Day 1", "2:00 PM"), "title", "description", and "status" (pending).
        3. Each object MUST have a "timestamp" for the calendar (targetDay as a Number, 1-31).
        4. [NEW: USER EMPOWERMENT]: Include a "user_todos" array in the root object.
           - Generate 1-4 tasks that the USER should do on their end to succeed.
           - BE SPECIFIC: If it's a presentation, add "Practice slides". If it's dance, add "Rehearsals". If it's cooking, add "Wash utensils/Pre-heat".
           - Use natural, helpful language for these tasks.
           - Each user todo should have { "text": "...", "priority": "high/medium/low" }.
        
        Respond ONLY with a JSON object.
        Example: { 
            "intensity": "high", 
            "totalPhases": 3,
            "schedule": [
                { "timeLabel": "Next 2 Hours", "title": "Data Ingestion", "description": "Gathering sources...", "status": "pending", "targetDay": 25 }
            ],
            "user_todos": [
                { "text": "Review presentation flow", "priority": "high" },
                { "text": "Practice verbal delivery", "priority": "medium" }
            ]
        }
    `;

    try {
        let text = await aiService.generateWithFallback(prompt, systemPrompt);

        // Cleanup JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        } else {
            text = text.replace(/```json|```/g, "").trim();
        }

        return JSON.parse(text);
    } catch (error) {
        console.error("[Agent 8] Temporal Planning failed:", error.message);
        throw error;
    }
};

module.exports = { generateTimeline };
