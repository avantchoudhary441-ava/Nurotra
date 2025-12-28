const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
// Ensure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// List of models to try in order of preference (Smartest -> Most Available)
const modelsToTry = [
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-exp",
    "models/gemini-flash-latest"
];

// Helper to try generation with multiple models
const generateWithFallback = async (prompt) => {
    let lastError = null;
    for (const modelName of modelsToTry) {
        try {
            console.log(`Debug: Attempting model: ${modelName}`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.9, // High creativity
                    topP: 0.95,
                    topK: 40,
                }
            });

            const result = await model.generateContent(prompt);
            const response = result.response;
            return response.text().trim();
        } catch (error) {
            console.warn(`Debug: Model ${modelName} failed: ${error.message.split('[')[0]}... (Check full log if needed)`);
            lastError = error;
            continue; // Try next model
        }
    }
    throw lastError || new Error("All AI models failed");
};

/**
 * Generate 3 smart reply suggestions based on chat history
 */
const generateSmartReplies = async (history, userContext) => {
    try {
        const prompt = `
            You are a sharp, tactical negotiation coach on Nurotra.
            
            Context:
            - User Role: ${userContext?.role || "User"}
            - Chat History: ${JSON.stringify(history)}

            Task:
            Generate 3 UNCONVENTIONAL and HIGH-IMPACT reply options.
            Do NOT be boring. Do NOT use "Can you clarify?".
            
            Options must be:
            1. psychological_hook: A deeply engaging question or statement.
            2. power_move: A confident assertion of value.
            3. closer: A direct path to agreement.

            Style: Short, Punchy, Human. No robot-speak.
            Output strictly a valid JSON array of strings.
        `;

        let text = await generateWithFallback(prompt);
        // Clean up common markdown artifacts
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Smart Reply Final Failure:", error.message);
        return ["Let's get straight to business.", "What's the best price you can do?", "I'm ready when you are."];
    }
};

/**
 * Generate a personalized opening message for a new match
 */
const generateOpener = async (matchData, senderData) => {
    try {
        const prompt = `
            You are drafting an initial outreach message on Nurotra.
            
            Sender: ${senderData?.name} (${senderData?.role})
            Recipient: ${matchData?.name || "Target User"}
            Context: Compatibility ${matchData?.matchScore || "High"}, Niche: ${matchData?.niche}, Goal: ${matchData?.focus}

            Task:
            Write a single, highly engaging, personalized opening message (max 2 sentences).
            Be warm but professional. Mention usage of Nurotra's matching to establish credibility.
            NO hashtags.
        `;
        return await generateWithFallback(prompt);
    } catch (error) {
        console.error("Gemini Opener Error:", error.message);
        return `Hi ${matchData?.name || "there"}, noticed our profiles are a strong match on Nurotra. Interested in collaborating?`;
    }
};

/**
 * Generate a structured summary of the conversation
 */
const generateSummary = async (history) => {
    try {
        const prompt = `
            Analyze this chat:
            ${JSON.stringify(history)}

            Output strictly JSON:
            {
                "status": "New" | "Negotiating" | "Agreed" | "Stalled",
                "keyPoints": "Short summary of deal terms (price, deliverables)",
                "tone": "Positive" | "Neutral" | "Negative"
            }
            No markdown.
        `;

        let text = await generateWithFallback(prompt);
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Summary Error:", error.message);
        return { status: "Negotiating", keyPoints: "Discussion ongoing", tone: "Neutral" };
    }
};

/**
 * Enhance text tone and grammar
 */
const enhanceText = async (draftText) => {
    try {
        const prompt = `
            Your goal is to TRANSFORM this text into a Masterpiece of Persuasion.
            Do NOT just fix grammar. REWRITE IT COMPLETELY.

            Input: "${draftText}"

            Instructions:
            1. Fix all broken English/Typos immediately.
            2. Make it sound Confident, Professional, and High-Status.
            3. If the input is weak (e.g. "plz reply"), change it to strong (e.g. "I look forward to your prompt response.").
            4. Keep the core meaning but MAXIMIZE the impact.

            Output ONLY the rewritten text. pure text.
        `;

        let text = await generateWithFallback(prompt);
        // Remove quotes if any
        text = text.replace(/^"|"$/g, '').trim();
        return text;
    } catch (error) {
        console.error("Gemini Enhance Error:", error.message);
        return draftText; // Fail safe
    }
};

/**
 * Nurotra Profile Enhancer Engine
 * Analyzes profile data and returns a structured "Upgrade Report"
 */
const analyzeProfile = async (profileData) => {
    try {
        const prompt = `
            You are Nurotra's Elite Profile Coach.
            Analyze this Creator/Brand profile and provide a structured "Upgrade Report".

            Profile Data:
            - Role: ${profileData.role || "Influencer"}
            - Niche: ${profileData.niche || "Unspecified"}
            - Bio/Note: "${profileData.noteToBrand || profileData.bio || "No bio info"}"
            - Followers: ${profileData.followers || "N/A"}
            - Platform: ${profileData.primaryPlatform} (${profileData.platformUrl})
            - Worked Before: ${profileData.workedBefore || "No"}

            Task:
            Analyze 5 Key Dimensions and output a STRICT JSON object:

            1. "strengthAnalysis":
               - "score": (0-100 integer)
               - "strengths": Array of 3 short strings (e.g. "Clear Niche", "Good Engagement Identity").
            
            2. "gapAnalysis":
               - "gaps": Array of objets { "title": "Missing Portfolio", "severity": "Medium", "reason": "Brands need proof of past work." }
               - Use "Amber" tone, not "Red". Constructive criticism.

            3. "marketComparison":
               - Compare this user to the "Top 10%" in their niche.
               - "you": { "clarity": 70, "engagement": 60, "professionalism": 50 }
               - "top10": { "clarity": 95, "engagement": 90, "professionalism": 95 }
               - "average": { "clarity": 60, "engagement": 50, "professionalism": 60 }

            4. "optimizationSuggestions":
               - Array of 3 objects: { "title": "Actionable Step", "impact": "High", "instruction": "Step-by-step guide on what to change." }

            5. "projectedImpact":
               - "matchQualityUplift": (10-30 integer)
               - "replyRateUplift": (10-30 integer)

            Structure the JSON strictly. No markdown.
        `;

        let text = await generateWithFallback(prompt);
        // Clean JSON
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);

    } catch (error) {
        console.error("Profile Analysis Error:", error.message);
        // Fallback Mock Data to prevent UI crash
        return {
            strengthAnalysis: { score: 70, strengths: ["Active Account", "defined Platform"] },
            gapAnalysis: { gaps: [{ title: "Optimization Pending", severity: "Low", reason: "AI connection failed." }] },
            marketComparison: {
                you: { clarity: 60, engagement: 50, professionalism: 60 },
                top10: { clarity: 90, engagement: 90, professionalism: 95 },
                average: { clarity: 50, engagement: 50, professionalism: 50 }
            },
            optimizationSuggestions: [],
            projectedImpact: { matchQualityUplift: 15, replyRateUplift: 10 }
        };
    }
};

module.exports = {
    generateSmartReplies,
    generateOpener,
    generateSummary,
    enhanceText,
    analyzeProfile
};
