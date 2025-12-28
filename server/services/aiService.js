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

        return await generateWithFallback(prompt);
    } catch (error) {
        console.error("Gemini Enhance Error:", error.message);
        return draftText;
    }
};

module.exports = {
    generateSmartReplies,
    generateOpener,
    generateSummary,
    enhanceText
};
