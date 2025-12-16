const mongoose = require("mongoose");

const BrandProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String },
    website: { type: String },
    companyType: { type: String },
    industry: { type: String },
    contact: { type: String },
    contentType: { type: String },
    budget: { type: Number },
});

module.exports = mongoose.model("BrandProfile", BrandProfileSchema);
