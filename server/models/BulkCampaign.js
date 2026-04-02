const mongoose = require("mongoose");

const BulkCampaignSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: { type: String, required: true },
    baseMessage: { type: String, required: true },
    subject: { type: String },
    totalRecipients: { type: Number, default: 0 },
    status: { type: String, enum: ["sending", "active", "completed", "failed"], default: "sending" },
    stats: {
        sent: { type: Number, default: 0 },
        failed: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model("BulkCampaign", BulkCampaignSchema);
