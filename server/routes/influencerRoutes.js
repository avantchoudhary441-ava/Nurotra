const express = require("express");
const router = express.Router();
const Influencer = require("../models/Influencer");
const User = require("../models/User");
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
        const {
            nuroId, email, primaryPlatform, platformUrl, socialHandle, fullName, contactNumber,
            followers, engagementRate, audienceAge, targetingLocation, collabExperience, noteToBrand,
            workedBefore, brandName, contentTypes, budget, niche, profileImg
        } = req.body;

        const influencerFields = {
            userId: req.user._id,
            nuroId, email, primaryPlatform, platformUrl, socialHandle, fullName, contactNumber,
            followers, engagementRate, audienceAge, targetingLocation, collabExperience, noteToBrand,
            workedBefore, brandName, contentTypes, budget, niche, profileImg
        };

        let influencer = await Influencer.findOne({ userId: req.user._id });

        if (influencer) {
            influencer = await Influencer.findOneAndUpdate(
                { userId: req.user._id },
                { $set: influencerFields },
                { new: true }
            );
        } else {
            influencer = new Influencer(influencerFields);
            await influencer.save();

            req.user.role = "influencer";
        }

        // Always sync profileImg to User model
        if (profileImg) {
            req.user.profileImg = profileImg;
        }
        await req.user.save();

        res.json({ success: true, influencer, role: "influencer" });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
