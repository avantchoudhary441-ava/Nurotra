const Message = require("../models/Message");
const User = require("../models/User");
const Chat = require("../models/Chat");
const { logEvent } = require("../utils/eventLogger");

// @desc    Send new message
// @route   POST /api/message
// @access  Protected
const sendMessage = async (req, res) => {
    const { content, chatId, attachments, type } = req.body;
    const io = req.app.get("socketio");

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

        // Emit Socket Event for real-time notification
        if (io) {
            message.chat.users.forEach((u) => {
                if (u._id.toString() === message.sender._id.toString()) return;
                io.to(u._id.toString()).emit("message received", message);
            });
        }

        // Log Message Sent
        await logEvent(req.user._id, "message_sent", { chatId: message.chat._id });

        // Log Message Received for the other user(s)
        const recipient = message.chat.users.find(u => u._id.toString() !== message.sender._id.toString());
        if (recipient) {
            await logEvent(recipient._id, "message_received", { chatId: message.chat._id });
        }

        // Admin Control Room: Track Activity & Lifecycle
        const sender = await User.findById(req.user._id);
        if (sender) {
            sender.lastActivityAt = new Date();

            // Advance from onboarded to activated
            if (sender.lifecycleStatus === "onboarded") {
                sender.lifecycleStatus = "activated";
            }

            // If influencer sending first message
            if (sender.role === "influencer") {
                sender.onboardingProgress.firstMessageSent = true;
                // If they are activated, move to outreach_sent
                if (sender.lifecycleStatus === "activated") {
                    sender.lifecycleStatus = "outreach_sent";
                }
            }

            await sender.save();
        }

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
