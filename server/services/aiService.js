const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
// Ensure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

/**
 * Generate 3 smart reply suggestions based on chat history
 */
const generateSmartReplies = async (history, userContext) => {
    try {
        const prompt = `
            You are a top-tier negotiation coach on Nurotra (an Influencer-Brand platform).
            
            Context:
            - User Role: ${userContext?.role || "User"}
            - Niche: ${userContext?.niche || "General"}
            - Chat History:
            ${JSON.stringify(history)}

            Task:
            Generate exactly 3 DISTINCT, high-value reply options for the User:
            1. A clarifying question (to get more info).
            2. A polite but firm negotiation statement.
            3. A positive forward-moving action.

            Style: Professional yet conversational (WhatsApp business style). Short (max 12 words).
            
            Output strictly a valid JSON array of strings. Example: ["Could you clarify the budget?", "I typically work at a higher rate.", "Sounds great, send the contract."]
            Do not include markdown.
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        // Clean up common markdown artifacts
        let text = response.text().trim();
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Smart Reply Error:", error);
        return ["Can you share more details?", "What isn't clear?", "Let's discuss rates."];
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

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini Opener Error:", error);
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

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Summary Error:", error);
        return { status: "Negotiating", keyPoints: "Discussion ongoing", tone: "Neutral" };
    }
};

/**
 * Enhance text tone and grammar
 */
const enhanceText = async (draftText) => {
    try {
        const prompt = `
            Act as a professional copywriter.
            Rewrite the following text to be strictly professional, persuasive, and grammatically perfect.
            
            Rules:
            1. Correct all typos and slang (e.g., "iam" -> "I am").
            2. Elevate the vocabulary (make it sound premium).
            3. Make it concise but polite.
            4. If the input is nonsense, try to interpret the intent or return "Could you clarify?".
            
            Input: "${draftText}"
            
            Output ONLY the rewritten text string. No quotes, no intro.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini Enhance Error:", error);
        return draftText;
    }
};

module.exports = {
    generateSmartReplies,
    generateOpener,
    generateSummary,
    enhanceText
};
