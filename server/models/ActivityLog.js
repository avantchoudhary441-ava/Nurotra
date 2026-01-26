const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            "apk_installed",
            "profile_completed",
            "brand_viewed",
            "message_drafted",
            "message_sent",
            "message_received",
            "collab_started",
            "collab_completed",
            "feedback_submitted",
            "login",
            "logout"
        ]
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
