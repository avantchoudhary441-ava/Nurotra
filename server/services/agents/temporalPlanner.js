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
 */
const generateTimeline = async (prompt, intentData, temporalContext) => {
    const systemPrompt = `
        You are the Nurotra Temporal Planner. 
        Your mission is to take a user goal and a deadline and generate a realistic, time-scaled execution schedule.
        
        [GROUND TRUTH TIME]:
        ${temporalContext}
        
        [USER INTENT]:
        ${JSON.stringify(intentData)}

        STRATEGY:
        1. Calculate the duration between "Current Time" and the "Deadline".
        2. If the duration is < 24 hours: Use HOURLY time buckets.
        3. If the duration is > 24 hours: Use DAILY time buckets.
        4. SCALE INTENSITY:
           - "Critical/High Urgency": High density of tasks, parallel phases.
           - "Low Urgency": Sequential, detailed phases.
        
        RULES:
        - Output a "schedule" array of objects.
        - Each object MUST have: "timeLabel" (e.g., "Day 1", "2:00 PM"), "title", "description", and "status" (pending).
        - Each object MUST have a "timestamp" for the calendar (targetDay as a Number, 1-31).
        
        Respond ONLY with a JSON object.
        Example: { 
            "intensity": "high", 
            "totalPhases": 3,
            "schedule": [
                { "timeLabel": "Next 2 Hours", "title": "Data Ingestion", "description": "Gathering sources...", "status": "pending", "targetDay": 25 },
                { "timeLabel": "Next 4 Hours", "title": "Drafting", "description": "Core layout...", "status": "pending", "targetDay": 25 }
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
