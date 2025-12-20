const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
    {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        content: { type: String, trim: true },
        chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        attachments: [{ type: String }], // Array of URLs
        type: { type: String, default: "text" }, // text, image, file, system
    },
    { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
