const Chat = require("../models/Chat");
const Message = require("../models/Message");
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Shared helper to get existing chat or create new one with auto-title
 */
exports.getOrCreateChat = async (userId, chatId, firstPrompt) => {
    if (chatId) {
        const chat = await Chat.findOne({ _id: chatId, users: userId });
        if (chat) return chat;
    }

    // Generate a short title for the new chat
    let chatName = "New Orchestration";
    try {
        const titleRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ 
                role: "system", 
                content: "Generate a 3-5 word descriptive title for a chat that starts with this prompt. return ONLY the title. No quotes." 
            }, { role: "user", content: firstPrompt }],
            max_tokens: 15
        });
        chatName = titleRes.choices[0].message.content.trim() || "New Orchestration";
    } catch (e) {
        console.error("Title generation failed:", e);
    }

    return await Chat.create({
        chatName,
        users: [userId],
        isGroupChat: false
    });
};

/**
 * Shared helper to save a message
 */
exports.saveMessage = async (chatId, senderId, content, type = "text") => {
    if (!chatId) return null;
    return await Message.create({
        chat: chatId,
        sender: senderId, // null for assistant
        content: content,
        type: type
    });
};

/**
 * Get all Orchestrator chats for the current user
 * GET /api/orchestrator/history
 */
exports.getChats = async (req, res) => {
    try {
        const userId = req.user?._id;
        const chats = await Chat.find({
            users: userId,
            isGroupChat: false,
            // We can filter by chatName starts with or has some metadata if needed
        })
        .sort({ updatedAt: -1 })
        .limit(20);

        res.json(chats);
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

/**
 * Get all messages for a specific chat
 * GET /api/orchestrator/chat/:id
 */
exports.getChatMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        // Verify the chat belongs to the user
        const chat = await Chat.findOne({ _id: id, users: userId });
        if (!chat) {
            return res.status(404).json({ error: "Chat not found" });
        }

        const messages = await Message.find({ chat: id })
            .populate("sender", "name email")
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
};

/**
 * Delete a chat session
 * DELETE /api/orchestrator/chat/:id
 */
exports.deleteChat = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const chat = await Chat.findOneAndDelete({ _id: id, users: userId });
        if (!chat) {
            return res.status(404).json({ error: "Chat not found" });
        }

        // Also delete linked messages
        await Message.deleteMany({ chat: id });

        res.json({ message: "Chat deleted success" });
    } catch (error) {
        console.error("Error deleting chat:", error);
        res.status(500).json({ error: "Failed to delete chat" });
    }
};
/**
 * Get simplified history for AI context
 */
exports.getHistory = async (chatId) => {
    if (!chatId) return [];
    try {
        const messages = await Message.find({ chat: chatId }).sort({ createdAt: 1 });
        return messages.map(m => ({
            role: m.sender ? 'user' : 'assistant',
            content: m.content
        }));
    } catch (e) {
        console.error("[ChatController] History retrieval failed:", e);
        return [];
    }
};
