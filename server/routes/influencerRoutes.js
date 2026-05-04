const express = require("express");
const router = express.Router();
const Influencer = require("../models/Influencer");
const User = require("../models/User");
const { logEvent } = require("../utils/eventLogger");

const jwt = require("jsonwebtoken");

// Reuse middleware logic (Duplicate for isolation/speed, can be imported)
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

// @route   GET /api/influencer
// @desc    Get current user's influencer profile
router.get("/", protect, async (req, res) => {
    try {
        const influencer = await Influencer.findOne({ userId: req.user._id }).populate("userId", ["name", "email", "totalCollabs", "successfulCollabs"]);
        if (!influencer) return res.status(404).json({ msg: "Influencer profile not found" });
        res.json(influencer);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/influencer/:userId
// @desc    Get influencer profile by userId
router.get("/:userId", protect, async (req, res) => {
    try {
        const influencer = await Influencer.findOne({ userId: req.params.userId }).populate("userId", ["name", "email", "totalCollabs", "successfulCollabs"]);
        if (!influencer) return res.status(404).json({ msg: "Influencer profile not found" });
        res.json(influencer);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/influencer
// @desc    Create/Update Influencer Profile & Upgrade User Role
router.post("/", protect, async (req, res) => {
    try {
        const updateData = {};
        const fields = [
            "nuroId", "email", "primaryPlatform", "platformUrl", "socialHandle", "fullName", "contactNumber",
            "followers", "engagementRate", "audienceAge", "targetingLocation", "collabExperience", "noteToBrand",
            "workedBefore", "brandName", "contentTypes", "budget", "niche", "profileImg"
        ];

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        let influencer = await Influencer.findOneAndUpdate(
            { userId: req.user._id },
            { $set: updateData },
            { new: true, upsert: true }
        );

        // Always sync profileImg to User model if provided
        if (req.body.profileImg) {
            req.user.profileImg = req.body.profileImg;
        }

        // Advance User Lifecycle
        req.user.lifecycleStatus = "onboarded";
        req.user.lastActivityAt = new Date();
        req.user.onboardingProgress.profileCompleted = true;
        await req.user.save();

        // Log event
        await logEvent(req.user._id, "profile_completed");

        res.json({ success: true, influencer, role: "influencer" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
