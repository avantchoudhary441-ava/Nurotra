const mongoose = require("mongoose");

const SyncTaskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    platform: { type: String, required: true },
    action: { type: String, required: true }, // e.g., "push_to_sheets", "update_crm"
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    priority: { 
        type: String, 
        enum: ["high", "medium", "low"], 
        default: "medium" 
    },
    status: { 
        type: String, 
        enum: ["pending", "processing", "completed", "failed", "retrying"], 
        default: "pending" 
    },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    nextAttempt: { type: Date, default: Date.now },
    lastError: { type: String }
}, { timestamps: true });

SyncTaskSchema.index({ status: 1, nextAttempt: 1, priority: 1 });

module.exports = mongoose.model("SyncTask", SyncTaskSchema);
