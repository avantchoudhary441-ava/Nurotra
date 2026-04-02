const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ["file", "contact", "data", "tool", "context"],
        required: true,
        index: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    refId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        index: true
    },
    tags: [{
        type: String,
        trim: true,
        index: true
    }],
    lastMentioned: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Powerful text index for intelligent retrieval
resourceSchema.index({ title: "text", tags: "text" });

module.exports = mongoose.model("Resource", resourceSchema);
