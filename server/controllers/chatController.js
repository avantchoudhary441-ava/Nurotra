const Chat = require("../models/Chat");
const User = require("../models/User");
const NuroMemory = require("../models/NuroMemory");

// @desc    Access a chat (Create if not exists, else fetch)
// @route   POST /api/chat
// @access  Protected
const accessChat = async (req, res) => {
    const { userId } = req.body; // The other user's ID

    if (!userId) {
        console.log("UserId param not sent with request");
        return res.sendStatus(400);
    }

    // Check if chat exists
    var isChat = await Chat.find({
        isGroupChat: false,
        $and: [
            { users: { $elemMatch: { $eq: req.user._id } } },
            { users: { $elemMatch: { $eq: userId } } },
        ],
    })
        .populate("users", "-password")
        .populate("latestMessage");

    // Populate sender of latest message
    isChat = await User.populate(isChat, {
        path: "latestMessage.sender",
        select: "name profileImg email",
    });

    if (isChat.length > 0) {
        res.send(isChat[0]);
    } else {
        // Create new chat
        var chatData = {
            chatName: "sender",
            isGroupChat: false,
            users: [req.user._id, userId],
        };

        try {
            const createdChat = await Chat.create(chatData);
            const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
                "users",
                "-password"
            );
            res.status(200).json(FullChat);
        } catch (error) {
            res.status(400);
            throw new Error(error.message);
        }
    }
};

// @desc    Fetch all chats for a user
// @route   GET /api/chat
// @access  Protected
const fetchChats = async (req, res) => {
    try {
        Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
            .populate("latestMessage")
            .sort({ updatedAt: -1 })
            .then(async (results) => {
                results = await User.populate(results, {
                    path: "latestMessage.sender",
                    select: "name profileImg email",
                });
                res.status(200).send(results);
            });
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
};

// @desc    Record collaboration status
// @route   POST /api/chat/collab/record
// @access  Protected
const recordCollaboration = async (req, res) => {
    const { chatId, status } = req.body; // status: 'success' or 'failed'

    if (!chatId || !status) {
        return res.status(400).send("ChatId and status required");
    }

    try {
        const chat = await Chat.findById(chatId).populate("users");

        if (!chat) {
            return res.status(404).send("Chat not found");
        }

        // 1. Update User Statistics
        if (status === 'success') {
            for (const user of chat.users) {
                await User.findByIdAndUpdate(user._id, { $inc: { totalCollabs: 1 } });
            }
        }

        // 2. Update Nuro Memory for BOTH users
        for (const user of chat.users) {
            let memory = await NuroMemory.findOne({ userId: user._id });

            // If no memory exists, use default initialization similar to nuroController
            if (!memory) {
                memory = new NuroMemory({
                    userId: user._id,
                    metrics: {
                        communicationClarity: 70, // Start higher for better first impression
                        reliabilityScore: 70,
                        trustIndex: 70,
                    }
                });
            }

            // Find partner info
            const partner = chat.users.find(u => u._id.toString() !== user._id.toString());

            // Add to collab history
            memory.collabHistory.push({
                collabId: chatId,
                partnerName: partner?.name || "Anonymous Partner",
                outcome: status === 'success' ? 'Success' : 'Failed',
                overallScore: status === 'success' ? 85 : 30, // Simulated scores
                aiTag: status === 'success' ? 'Smooth' : 'Mismatch',
                timestamp: new Date()
            });

            // Minor score adjustment based on outcome
            if (status === 'success') {
                memory.metrics.reliabilityScore = Math.min(100, memory.metrics.reliabilityScore + 2);
                memory.metrics.trustIndex = Math.min(100, memory.metrics.trustIndex + 1);
            } else {
                memory.metrics.reliabilityScore = Math.max(0, memory.metrics.reliabilityScore - 5);
            }

            await memory.save();
        }

        res.status(200).json({ message: "Collaboration recorded and Nuro memory updated", status });
    } catch (error) {
        console.error("Record Collaboration Error:", error);
        res.status(400);
        throw new Error(error.message);
    }
};

module.exports = { accessChat, fetchChats, recordCollaboration };
