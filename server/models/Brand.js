const mongoose = require("mongoose");

const BrandSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true, // One brand profile per user
    },
    nuroId: { type: String, required: true },
    brandName: { type: String }, // New field
    website: { type: String, required: true },
    companyType: { type: String, default: "Startup" },
    contact: { type: String, required: true },
    industry: { type: String, default: "Tech" }, // Using as Niche

    // Matching Info
    contentTypes: [{ type: String }], // Changed to array for multi-select
    budget: { type: String },

    // Objective
    campaignGoal: {
        type: String,
        enum: ["Brand Awareness", "Product Promotion", "Event Promotion", "App Installs", "UGC Content", "Community Building", "Product Launch", "Product Awareness", "Other"]
    },

    // Influencer Requirements
    influencerCategory: {
        type: String,
        enum: ["Nano (1k-10k)", "Micro (10k-100k)", "Macro (100k-1M)", "Celebrity (1M+)"]
    },
    minEngagement: {
        type: String,
        enum: ["1-3%", "3-5%", "5-10%", "10%+"]
    },
    platform: {
        type: String,
        enum: ["Instagram", "YouTube", "TikTok", "X (Twitter)", "Facebook", "Other"]
    },

    // Budget & Timeline
    collabDuration: {
        type: String,
        enum: ["Immediate (24 hours)", "2-3 days", "1 week", "1-4 weeks"]
    },
    noteToInfluencer: { type: String }, // Optional

    profileImg: { type: String },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Brand", BrandSchema);
