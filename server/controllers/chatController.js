const Chat = require("../models/Chat");
const User = require("../models/User");

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

        // Logic to record collaboration
        // 1. Update Chat metadata (if we had a field for it, currently purely counting)
        // 2. Increment user collaboration counts

        // Increment totalCollabs for all users in the chat (regardless of outcome)
        for (const user of chat.users) {
            const update = { $inc: { totalCollabs: 1 } };
            // If successful, also increment successfulCollabs
            if (status === 'Collaboration Successful') {
                update.$inc.successfulCollabs = 1;
            }
            await User.findByIdAndUpdate(user._id, update);
        }

        chat.collabStatus = status;
        await chat.save();

        // 3. Trigger Nuro Post-Mortem for both users automatically
        try {
            const { aiService } = require('../services/aiService');
            const NuroMemory = require('../models/NuroMemory');

            for (const participant of chat.users) {
                // Find the partner (the other person in the chat)
                const partner = chat.users.find(u => u._id.toString() !== participant._id.toString());
                const partnerName = partner ? partner.name : "Anonymous Partner";

                // Run Analysis
                const analysis = await aiService.analyzeCollaborationBehavior({
                    chatLogs: [], // In real prod, fetch messages here
                    outcome: status
                });

                // Save to Participant's Nuro Memory
                let pMemory = await NuroMemory.findOne({ userId: participant._id });
                if (!pMemory) {
                    // Fail-safe: if memory doesn't exist, it will be initialized on next fetch
                    // but for now let's just create a basic one if needed
                    pMemory = new NuroMemory({ userId: participant._id });
                }

                pMemory.collabHistory.push({
                    collabId: chat._id.toString(),
                    partnerName,
                    overallScore: analysis.overallScore,
                    outcome: status.includes('Successful') ? 'Success' : 'Failed',
                    rootCause: analysis.rootCause,
                    predictedSuccessProbability: analysis.predictedSuccessProbability,
                    positives: analysis.positives,
                    negatives: analysis.negatives
                });

                // Update metrics
                pMemory.metrics.communicationClarity = (pMemory.metrics.communicationClarity * 0.7) + (analysis.metrics.communicationClarity * 0.3);
                pMemory.metrics.reliabilityScore = (pMemory.metrics.reliabilityScore * 0.7) + (analysis.metrics.reliability * 0.3);
                pMemory.metrics.trustIndex = (pMemory.metrics.trustIndex * 0.7) + (analysis.metrics.trustIndex * 0.3);

                await pMemory.save();
            }
        } catch (nuroErr) {
            console.error("Auto-Nuro Post-Mortem Failed:", nuroErr);
            // Don't fail the main request if Nuro fails, just log it
        }

        res.status(200).json({ message: "Collaboration recorded", status });
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
};

module.exports = { accessChat, fetchChats, recordCollaboration };
