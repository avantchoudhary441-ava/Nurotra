const mongoose = require("mongoose");
const crypto = require("crypto");

const EventRuleSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
    trigger: {
        type: { type: String, enum: ["manual", "webhook", "message_received", "system_state", "scheduled"], required: true },
        source: { type: String, default: "" },
        webhookId: { type: String, default: () => crypto.randomBytes(16).toString("hex") }
    },
    conditions: [{
        field: { type: String },
        operator: { type: String }, // Relaxed for AI
        value: { type: mongoose.Schema.Types.Mixed }
    }],
    conditionLogic: { type: String, enum: ["AND", "OR"], default: "AND" },
    conditionRawText: { type: String },
    actions: [{
        id: { type: Number },
        label: { type: String },
        icon: { type: String, default: "default" },
        delayMs: { type: Number, default: 2000 },
        microLogs: [{ type: String }],
        retryConfig: {
            maxRetries: { type: Number, default: 1 },
            retryDelayMs: { type: Number, default: 2000 }
        }
    }],
    executionCount: { type: Number, default: 0 },
    lastTriggered: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("EventRule", EventRuleSchema);
