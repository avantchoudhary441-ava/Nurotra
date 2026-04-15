const mongoose = require("mongoose");

const IntegrationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        enum: ["google_sheets", "excel", "notion", "custom", "generic_search"]
    },
    authType: {
        type: String,
        enum: ["session_cookies", "oauth2", "password", "api_key"],
        default: "session_cookies"
    },
    credentials: {
        username: { type: String },
        password: { type: String }, // Should be encrypted in a real production app
        apiKey: { type: String }
    },
    sessionData: {
        cookies: { type: Array, default: [] },
        localStorage: { type: Object, default: {} },
        lastLogin: { type: Date }
    },
    status: {
        type: String,
        enum: ["connected", "expired", "failed", "pending_setup"],
        default: "pending_setup"
    },
    metadata: {
        lastAttempt: { type: Date },
        errorLogs: [{ type: String }],
        successCount: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model("Integration", IntegrationSchema);
