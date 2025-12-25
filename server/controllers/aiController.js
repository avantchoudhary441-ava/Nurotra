const aiService = require("../services/aiService");
const Chat = require("../models/Chat");
const Message = require("../models/Message");

/**
 * Suggest Replies
 * Route: POST /api/chat/ai/suggest
 */
const suggestReplies = async (req, res) => {
    const { chatId } = req.body;

    if (!chatId) return res.status(400).send("Chat ID required");

    try {
        // Fetch last 5 messages
        const messages = await Message.find({ chat: chatId })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("sender", "name role");

        // Format for AI
        const history = messages.reverse().map(m => ({
            sender: m.sender.name,
            role: m.sender.role,
            content: m.content
        }));

        const userContext = {
            role: req.user.role, // from auth middleware
            niche: req.user.niche || "General"
        };

        const suggestions = await aiService.generateSmartReplies(history, userContext);
        res.json({ suggestions });
    } catch (error) {
        console.error("Suggest Replies Error:", error);
        res.status(500).send("Failed to generate suggestions");
    }
};

/**
 * Generate Opener
 * Route: POST /api/chat/ai/opener
 */
const generateOpener = async (req, res) => {
    const { matchData } = req.body;
    // matchData should contain: name, niche, matchScore, focus

    try {
        const senderData = {
            name: req.user.name,
            role: req.user.role
        };

        const opener = await aiService.generateOpener(matchData, senderData);
        res.json({ opener });
    } catch (error) {
        console.error("Opener Error:", error);
        res.status(500).send("Failed to generate opener");
    }
};

/**
 * Summarize Chat
 * Route: POST /api/chat/ai/summarize
 */
const summarizeChat = async (req, res) => {
    const { chatId } = req.body;

    try {
        const messages = await Message.find({ chat: chatId })
            .sort({ createdAt: 1 })
            .populate("sender", "name");

        const history = messages.map(m => `${m.sender.name}: ${m.content}`);

        const summaryData = await aiService.generateSummary(history);

        // Update Chat Model
        await Chat.findByIdAndUpdate(chatId, {
            summary: summaryData.keyPoints,
            negotiationStatus: summaryData.status
        });

        res.json(summaryData);
    } catch (error) {
        console.error("Summary Error:", error);
        res.status(500).send("Failed to summarize");
    }
};

/**
 * Enhance Text
 * Route: POST /api/chat/ai/enhance
 */
const enhanceText = async (req, res) => {
    const { text } = req.body;

    if (!text) return res.status(400).send("Text required");

    try {
        const enhancedText = await aiService.enhanceText(text);
        res.json({ enhancedText });
    } catch (error) {
        console.error("Enhance Error:", error);
        res.status(500).send("Failed to enhance text");
    }
};

module.exports = {
    suggestReplies,
    generateOpener,
    summarizeChat,
    enhanceText
};
