const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
    {
        chatName: { type: String, trim: true },
        isGroupChat: { type: Boolean, default: false },
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        latestMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
        },
        groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        // AI Negotiation Fields
        negotiationStatus: {
            type: String,
            enum: ['new', 'negotiating', 'agreed', 'stalled'],
            default: 'new'
        },
        summary: { type: String, default: "" },
        matchContext: { type: Object }, // Snapshot of match data
        collabStatus: {
            type: String,
            enum: ['none', 'Collaboration Successful', 'Collaboration Unsuccessful'],
            default: 'none'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Chat", ChatSchema);
