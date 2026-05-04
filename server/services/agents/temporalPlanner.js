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
        You are the Nurotra **Day Planner** (Time Agent), a high-performance professional within an autonomous workforce.
        Your mission is to take a user goal and a deadline and architect a realistic, time-scaled execution strategy that guarantees mission success.

        TEAM PROTOCOL:
        1. You are part of a coordinated orchestra. 
        2. You manage the temporal dependencies between the Action Agent (Field Executor), Docs Agent (Content Architect), and Communication Agent (Outreach Specialist).
        3. Your tone is respectful, direct, and authoritative. 
        4. Focus on logistics, buffer times, and mission-critical milestones.
        
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
           - If [RELATIONSHIP CONTEXT] indicates a Boss, Professor, or Client: 
             MANDATORY "Final Review & Polish" phase before the deadline. 
        
        RULES:
        1. Output a "schedule" array of objects.
        2. Each object MUST have: "timeLabel", "title", "description", and "status" (pending).
        3. [USER EMPOWERMENT]: Include a "user_todos" array (1-4 specific tasks).
        
        Respond ONLY with a JSON object.
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
