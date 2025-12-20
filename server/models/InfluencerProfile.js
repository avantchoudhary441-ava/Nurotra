const mongoose = require("mongoose");

const InfluencerProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    instagram: { type: String },
    followers: { type: String },
    niche: { type: String },
    contact: { type: String },
    // Fields required for Matching Algorithm
    engagementRate: { type: Number, default: 0 },
    budget: { type: String }, // Ask price, e.g. "1k"
    primaryPlatform: { type: String },
    contentTypes: [{ type: String }], // Array of strings e.g. ["Reels", "Post"]
    noteToBrand: { type: String },
    collabExperience: { type: String },
});

module.exports = mongoose.model("InfluencerProfile", InfluencerProfileSchema);
