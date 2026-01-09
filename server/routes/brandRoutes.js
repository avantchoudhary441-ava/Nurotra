const express = require("express");
const router = express.Router();
const Brand = require("../models/Brand");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Middleware to verify token (Simple version for speed, robust version is in middleware/authMiddleware.js if exists, but we'll implement inline for simplicity or reuse if available)
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            next();
        } catch (error) {
            res.status(401).json({ message: "Not authorized" });
        }
    } else {
        res.status(401).json({ message: "No token" });
    }
};

// @route   GET /api/brand
// @desc    Get current user's brand profile
router.get("/", protect, async (req, res) => {
    try {
        const brand = await Brand.findOne({ userId: req.user._id }).populate("userId", ["name", "email"]);
        if (!brand) return res.status(404).json({ msg: "Brand profile not found" });
        res.json(brand);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/brand/:userId
// @desc    Get brand profile by userId
router.get("/:userId", protect, async (req, res) => {
    try {
        const brand = await Brand.findOne({ userId: req.params.userId }).populate("userId", ["name", "email"]);
        if (!brand) return res.status(404).json({ msg: "Brand profile not found" });
        res.json(brand);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/brand
// @desc    Create/Update Brand Profile & Upgrade User Role
router.post("/", protect, async (req, res) => {
    try {
        const {
            nuroId, brandName, website, companyType, contact, industry, contentTypes, budget, profileImg,
            campaignGoal, influencerCategory, minEngagement, platform, collabDuration, noteToInfluencer
        } = req.body;

        const brandFields = {
            userId: req.user._id,
            nuroId, brandName, website, companyType, contact, industry, contentTypes, budget, profileImg,
            campaignGoal, influencerCategory, minEngagement, platform, collabDuration, noteToInfluencer
        };

        // Check if profile exists
        let brand = await Brand.findOne({ userId: req.user._id });

        if (brand) {
            // Update
            brand = await Brand.findOneAndUpdate(
                { userId: req.user._id },
                { $set: brandFields },
                { new: true }
            );
        } else {
            // Create
            brand = new Brand(brandFields);
            await brand.save();

            // Update User Role only on creation/first time
            req.user.role = "brand";
            await req.user.save();
        }

        res.json({ success: true, brand, role: "brand" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
