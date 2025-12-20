const mongoose = require("mongoose");

const InfluencerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true, // One influencer profile per user
    },
    nuroId: { type: String, required: true },
    email: { type: String, required: true },
    primaryPlatform: {
        type: String,
        required: true,
        enum: ["Instagram", "YouTube", "TikTok", "X (Twitter)", "Facebook", "Other"]
    },
    platformUrl: { type: String, required: true },
    socialHandle: { type: String },
    fullName: { type: String },
    contactNumber: { type: String },
    instagram: { type: String }, // Made optional as we use primaryPlatform now
    followers: {
        type: String,
        required: true,
        // Removed strict enum to prevent validation errors with frontend values
    },
    engagementRate: { type: Number, default: 0 },
    audienceAge: { type: [String] },
    targetingLocation: { type: [String] }, // e.g. ["India", "USA"]
    collabExperience: {
        type: String,
        enum: ["New to collaborations", "Barter experience", "Paid experience", "Both"]
    },
    noteToBrand: { type: String },
    workedBefore: { type: String, enum: ["Yes", "No"], default: "No" },
    brandName: { type: String }, // Only if workedBefore is Yes
    contentTypes: [{ type: String }],
    budget: { type: String },
    // brandType removed
    niche: { type: String },
    profileImg: { type: String },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Influencer", InfluencerSchema);
