const mongoose = require("mongoose");

const SyncLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    status: { 
        type: String, 
        enum: ["success", "partial", "failed", "retrying"], 
        default: "success" 
    },
    platforms: [String], // e.g., ["WhatsApp", "Google Sheets"]
    entity: { type: String }, // e.g., "Contact", "Deal", "Task"
    action: { type: String }, // e.g., "create", "update"
    payload: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    retries: { type: Number, default: 0 },
    latencyMs: { type: Number },
    conflicts: [{
        field: String,
        resolvedValue: mongoose.Schema.Types.Mixed,
        resolutionStrategy: String
    }],
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

SyncLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model("SyncLog", SyncLogSchema);
