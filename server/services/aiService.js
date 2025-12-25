const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
// Ensure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Generate 3 smart reply suggestions based on chat history
 */
const generateSmartReplies = async (history, userContext) => {
    try {
        const prompt = `
            You are a professional negotiation assistant for Influencer-Brand collaborations.
            
            Context:
            - User Role: ${userContext?.role || "User"}
            - Niche: ${userContext?.niche || "General"}
            - Current Conversation History (Last 5 messages):
            ${JSON.stringify(history)}

            Task:
            Generate exactly 3 short, professional, and distinct reply options for the User to send next.
            They should be casual but polite (Whatsapp style).
            Max 15 words per reply.
            
            Output strictly a valid JSON array of strings, e.g.: ["Sounds good!", "What is your budget?", "Can you share more details?"]
            Do not include markdown formatting like \`\`\`json.
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text().trim().replace(/^```json|```$/g, '');

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Smart Reply Error:", error);
        // Fallbacks if AI fails
        return ["Interested!", "Tell me more details", "Let's connect soon"];
    }
};

/**
 * Generate a personalized opening message for a new match
 */
const generateOpener = async (matchData, senderData) => {
    try {
        const prompt = `
            You are drafting an initial outreach message on a professional networking app (Nurotra).
            
            Sender: ${senderData?.name} (${senderData?.role})
            Recipient: ${matchData?.name || "Target User"}
            Match Context:
            - Compatibility: ${matchData?.matchScore || "High"}
            - Recipient Niche: ${matchData?.niche}
            - Mutual Interest: ${matchData?.focus || "Collaboration"}

            Task:
            Write a single, engaging, and warm opening message (max 2 sentences).
            Mention the high match compatibility or their niche to show personalization.
            Make it sound like a human wrote it, not a bot.
            Do not use hashtags.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini Opener Error:", error);
        return `Hi ${matchData?.name || "there"}, I noticed we have a great match profile on Nurotra. I'd love to explore a collaboration!`;
    }
};

/**
 * Generate a structured summary of the conversation
 */
const generateSummary = async (history) => {
    try {
        const prompt = `
            Analyze this negotiation chat and provide a summary.
            
            Chat History:
            ${JSON.stringify(history)}

            Output strictly a valid JSON object with these fields:
            - status: "New", "Negotiating", "Agreed", or "Stalled"
            - keyPoints: A short string summarizing the deal (e.g., "$500 for 2 posts")
            - tone: "Positive", "Neutral", "Negative"
            
            Do not include markdown formatting.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/^```json|```$/g, '');
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
            Refine the following text to be more professional, grammatically correct, and persuasive for a business conversation.
            Keep the original meaning but improve the tone.
            
            Original Text: "${draftText}"
            
            Output ONLY the refined text string. No quotes, no explanations.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini Enhance Error:", error);
        return draftText; // Return original if error
    }
};

module.exports = {
    generateSmartReplies,
    generateOpener,
    generateSummary,
    enhanceText
};
