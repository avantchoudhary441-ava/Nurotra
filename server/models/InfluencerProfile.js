const mongoose = require("mongoose");

const InfluencerProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    instagram: { type: String },
    followers: { type: String },
    niche: { type: String },
    contact: { type: String },
});

module.exports = mongoose.model("InfluencerProfile", InfluencerProfileSchema);
