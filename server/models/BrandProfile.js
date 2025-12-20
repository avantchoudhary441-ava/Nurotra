const mongoose = require("mongoose");

const BrandProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String },
    website: { type: String },
    companyType: { type: String },
    industry: { type: String },
    contact: { type: String },
    contentType: { type: String }, // Preferred single type
    contentTypes: [{ type: String }], // Array of types
    budget: { type: String }, // Budget range or max

    // Fields required for Matching
    minEngagement: { type: String }, // e.g. "3%+"
    campaignGoal: { type: String },
    platform: { type: String }, // e.g. "Instagram"
    influencerCategory: { type: String }, // e.g. "10k - 50k"
});

module.exports = mongoose.model("BrandProfile", BrandProfileSchema);
