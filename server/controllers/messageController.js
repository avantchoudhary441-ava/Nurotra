const Message = require("../models/Message");
const User = require("../models/User");
const Chat = require("../models/Chat");

// @desc    Send new message
// @route   POST /api/message
// @access  Protected
const sendMessage = async (req, res) => {
    const { content, chatId, attachments, type } = req.body;

    if ((!content && (!attachments || attachments.length === 0)) || !chatId) {
        console.log("Invalid data passed into request");
        return res.sendStatus(400);
    }

    var newMessage = {
        sender: req.user._id,
        content: content || (attachments && attachments.length > 0 ? "Attachment" : ""),
        chat: chatId,
        attachments: attachments || [],
        type: type || "text"
    };

    try {
        var message = await Message.create(newMessage);

        // Deep populate for immediate return
        message = await message.populate("sender", "name profileImg");
        message = await message.populate("chat");
        message = await User.populate(message, {
            path: "chat.users",
            select: "name profileImg email",
        });

        // Update latest message in Chat
        await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

        res.json(message);
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
};

// @desc    Get all messages for a chat
// @route   GET /api/message/:chatId
// @access  Protected
const allMessages = async (req, res) => {
    try {
        const messages = await Message.find({ chat: req.params.chatId })
            .populate("sender", "name profileImg email")
            .populate("chat");
        res.json(messages);
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
};

module.exports = { sendMessage, allMessages };
