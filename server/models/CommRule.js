const mongoose = require("mongoose");

const commRuleSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ["follow_up", "broadcast", "reminder", "escalation"],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    trigger: {
        event: { type: String, required: true }, // e.g., "task_complete", "no_reply", "meeting_start"
        condition: { type: String, default: "" }, // e.g., "after 48 hours"
        timingHours: { type: Number, default: 48 }
    },
    action: {
        template: { type: String, default: "" }, // Message template with {{variables}}
        recipients: [{ type: String }], // emails or contact group names
        platform: { type: String, enum: ["email", "slack", "whatsapp"], default: "email" }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    executionCount: {
        type: Number,
        default: 0
    },
    lastExecutedAt: {
        type: Date
    }
}, {
    timestamps: true
});

commRuleSchema.index({ userId: 1, type: 1, isActive: 1 });

module.exports = mongoose.model("CommRule", commRuleSchema);
