const mongoose = require("mongoose");

const SyncMappingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    sourcePlatform: { type: String, required: true },
    targetPlatform: { type: String, required: true },
    // A dynamic map of source fields to target fields
    // e.g., { "client_name": "customer_name", "total_value": "amount" }
    fieldMap: {
        type: Map,
        of: String,
        default: {}
    },
    confidence: { type: Number, default: 0 }, // 0-100
    isUserVerified: { type: Boolean, default: false },
    lastMapped: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure we don't duplicate mapping definitions for the same platforms
SyncMappingSchema.index({ userId: 1, sourcePlatform: 1, targetPlatform: 1 }, { unique: true });

module.exports = mongoose.model("SyncMapping", SyncMappingSchema);
