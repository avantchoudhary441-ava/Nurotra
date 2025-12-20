const Brand = require("../models/Brand");
const Influencer = require("../models/Influencer");

// ---------------------------------------------------------
// HELPER FUNCTIONS (Normalization)
// ---------------------------------------------------------

// Parse "10k", "1M", "1000" to Number
const parseMetric = (str) => {
    if (!str) return 0;
    const s = str.toLowerCase().replace(/,/g, "").trim();
    if (s.includes("k")) return parseFloat(s) * 1000;
    if (s.includes("m")) return parseFloat(s) * 1000000;
    return parseFloat(s) || 0;
};

// Parse Range Strings (e.g., "1k – 10k") to Average Number
const parseRange = (rangeStr) => {
    if (!rangeStr) return 0;
    const parts = rangeStr.split(/[-–]/); // Split by hyphen or en-dash
    if (parts.length === 2) {
        const min = parseMetric(parts[0]);
        const max = parseMetric(parts[1]);
        return (min + max) / 2;
    }
    return parseMetric(rangeStr); // Single value or "1M+"
};

// Calculate Similarity (0 to 1)
const calculateSimilarity = (val1, val2) => {
    if (!val1 || !val2) return 0;
    const v1 = val1.toLowerCase();
    const v2 = val2.toLowerCase();
    if (v1 === v2) return 1;
    if (v1.includes(v2) || v2.includes(v1)) return 0.7; // Partial match
    return 0;
};

// ---------------------------------------------------------
// SCORING ENGINE
// ---------------------------------------------------------

const calculateMatchScore = (brand, influencer) => {
    let score = 0;

    // 1. NICHE / INDUSTRY (30%) - KEY FACTOR
    // Brand: industry, Influencer: niche
    const nicheMatch = calculateSimilarity(brand.industry, influencer.niche);
    score += nicheMatch * 30;

    // 2. CONTENT TYPE (20%)
    // Intersection of Arrays
    const brandContent = brand.contentTypes || [];
    const infContent = influencer.contentTypes || [];
    if (brandContent.length > 0 && infContent.length > 0) {
        const matches = brandContent.filter(t => infContent.includes(t));
        const ratio = matches.length / brandContent.length;
        score += ratio * 20;
    }

    // 3. PLATFORM (20%)
    // Exact match required for full points
    if (brand.platform === influencer.primaryPlatform) {
        score += 20;
    } else {
        // Soft Strictness: No points, but NOT hidden (implicitly handled by not adding to score)
    }

    // 4. ENGAGEMENT RATE (10%)
    // Brand: minEngagement (range string), Influencer: engagementRate (number)
    const minEng = parseRange(brand.minEngagement); // approx avg of requirement
    if (influencer.engagementRate >= minEng) {
        score += 10;
    } else {
        // Partial points if close (within 1%)
        if (influencer.engagementRate >= minEng - 1) score += 5;
    }

    // 5. BUDGET (10%)
    // Brand: budget (max), Influencer: budget (ask)
    // We treat budget strings roughly. If Brand Max >= Inf Ask
    const brandBudget = parseRange(brand.budget);
    const infBudget = parseRange(influencer.budget);

    // If brand didn't specify, or matches
    if (!brandBudget || brandBudget >= infBudget) {
        score += 10;
    } else {
        // Partial: within 20% diff
        if (brandBudget >= infBudget * 0.8) score += 5;
    }

    // 6. FOLLOWERS (5%)
    // Brand: influencerCategory, Influencer: followers
    const reqFollowers = parseRange(brand.influencerCategory);
    const actFollowers = parseRange(influencer.followers);

    // Allow broad range (0.5x to 2x of target)
    if (actFollowers >= reqFollowers * 0.5 && actFollowers <= reqFollowers * 2) {
        score += 5;
    }

    // 7. PREFERENCE / CAMPAIGN GOAL (5%)
    // Brand: campaignGoal, Influencer: noteToBrand / collabExperience
    const goal = brand.campaignGoal || "";
    const notes = (influencer.noteToBrand || "") + " " + (influencer.collabExperience || "");
    if (goal && notes.toLowerCase().includes(goal.toLowerCase())) {
        score += 5;
    }

    return Math.min(Math.round(score), 100);
};

// ---------------------------------------------------------
// CONTROLLERS
// ---------------------------------------------------------

// Find Influencers for a Brand
exports.matchForBrand = async (req, res) => {
    try {
        // Use authenticated user ID instead of nuroId from body
        const brand = await Brand.findOne({ userId: req.user._id });

        if (!brand) {
            return res.status(404).json({ message: "Brand profile not found. Please complete your profile first." });
        }

        const influencers = await Influencer.find({});

        // Manual Populate to ensure no schema errors
        const userIds = influencers.map(inf => inf.userId); // Fix: use userId
        const users = await require("../models/User").find({ _id: { $in: userIds } }, "name profileImg");
        const userMap = {};
        users.forEach(u => userMap[u._id.toString()] = u);

        const results = influencers.map(inf => {
            const score = calculateMatchScore(brand, inf);
            const userObj = userMap[inf.userId?.toString()] || {}; // Fix: use userId
            return {
                ...inf.toObject(),
                user: userObj, // Manually attach user object
                matchScore: score
            };
        });

        // Filter 0 scores if desired, or keep all (Soft Strictness = keep all sorted)
        results.sort((a, b) => b.matchScore - a.matchScore);

        res.json(results);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// Find Brands for an Influencer (Reverse Logic)
exports.matchForInfluencer = async (req, res) => {
    try {
        const influencer = await Influencer.findOne({ userId: req.user._id });

        if (!influencer) {
            return res.status(404).json({ message: "Influencer profile not found. Please complete your profile first." });
        }

        const brands = await Brand.find({});

        // Manual Populate
        const userIds = brands.map(b => b.userId); // Fix: use userId
        const users = await require("../models/User").find({ _id: { $in: userIds } }, "name profileImg");
        const userMap = {};
        users.forEach(u => userMap[u._id.toString()] = u);

        const results = brands.map(brand => {
            // Re-use logic: calculate score (it is symmetric in concept)
            const score = calculateMatchScore(brand, influencer);
            const userObj = userMap[brand.userId?.toString()] || {}; // Fix: use userId
            return {
                ...brand.toObject(),
                user: userObj,
                matchScore: score
            };
        });

        results.sort((a, b) => b.matchScore - a.matchScore);
        res.json(results);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};
