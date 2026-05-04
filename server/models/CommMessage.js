const mongoose = require("mongoose");

const commMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    contactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contact"
    },
    meetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting",
        index: true
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BulkCampaign",
        index: true
    },
    direction: {
        type: String,
        enum: ["sent", "received"],
        required: true
    },
    platform: {
        type: String,
        enum: ["email", "slack", "whatsapp"],
        lowercase: true,
        default: "email"
    },
    subject: {
        type: String,
        trim: true,
        default: ""
    },
    body: {
        type: String,
        required: true
    },
    recipientEmail: {
        type: String,
        trim: true
    },
    recipientName: {
        type: String,
        trim: true
    },
    context: {
        project: { type: String, default: "" },
        task: { type: String, default: "" },
        agentSource: { type: String, default: "" } // e.g., "docs_agent", "time_agent"
    },
    status: {
        type: String,
        enum: ["draft", "sent", "delivered", "failed", "pending_retry"],
        default: "draft"
    },
    // §2.2 Auto Follow-Up
    followUp: {
        enabled: { type: Boolean, default: false },
        intervalHours: { type: Number, default: 48 },
        maxAttempts: { type: Number, default: 3 },
        attemptsMade: { type: Number, default: 0 },
        nextFollowUpAt: { type: Date },
        priority: { type: String, enum: ["low", "medium", "high"], default: "medium" }
    },
    replyReceived: {
        type: Boolean,
        default: false
    },
    // §2.7 Failure Handling
    retry: {
        attempts: { type: Number, default: 0 },
        maxRetries: { type: Number, default: 3 },
        lastError: { type: String },
        escalationContact: { type: String }
    },
    sentAt: {
        type: Date
    },
    repliedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for digest queries and follow-up scanning
commMessageSchema.index({ userId: 1, sentAt: -1 });
commMessageSchema.index({ userId: 1, status: 1 });
commMessageSchema.index({ "followUp.enabled": 1, "followUp.nextFollowUpAt": 1, replyReceived: 1 });

module.exports = mongoose.model("CommMessage", commMessageSchema);
