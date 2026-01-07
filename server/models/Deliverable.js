const mongoose = require("mongoose");

const DeliverableSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String }, // e.g. "application/pdf", "image/png"
    category: {
        type: String,
        enum: [
            "Campaign Execution Proof",
            "Performance Evidence",
            "Communication & Professionalism",
            "Compliance & Safety",
            "Reliability & Consistency",
            "Experience Level",
            "Industry Exposure",
            "Other"
        ],
        default: "Other"
    },
    tags: [{ type: String }],
    aiAnalysis: {
        summary: String,
        keyTakeaways: [String],
        scoreImpact: {
            compatibility: Number,
            experience: Number,
            trust: Number,
            safety: Number,
            reliability: Number
        }
    },
    isPublic: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Deliverable", DeliverableSchema);
