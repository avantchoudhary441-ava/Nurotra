const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { logEvent } = require("../utils/eventLogger");


// Get high-level stats for the lifecycle funnel
exports.getDashboardStats = async (req, res) => {
    try {
        const { role } = req.query;
        let matchStage = {};

        if (role === "influencer" || role === "brand") {
            matchStage.role = role;
        } else {
            // Default to both influencers and brands, but EXCLUDE regular "user" role
            matchStage.role = { $in: ["influencer", "brand"] };
        }

        const stats = await User.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$lifecycleStatus",
                    count: { $sum: 1 }
                }
            }
        ]);

        const formattedStats = {
            applied: 0,
            onboarded: 0,
            activated: 0,
            brand_viewed: 0,
            outreach_sent: 0,
            brand_responded: 0,
            collab_in_progress: 0,
            collab_completed: 0,
            retention_loop: 0,
            dormant: 0
        };

        stats.forEach(s => {
            if (formattedStats.hasOwnProperty(s._id)) {
                formattedStats[s._id] = s.count;
            }
        });

        // Add At-Risk detection
        const atRiskQuery = {
            ...matchStage,
            $or: [
                { lastActivityAt: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
                { "onboardingProgress.profileCompleted": true, "onboardingProgress.firstMessageSent": false, createdAt: { $lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } }
            ]
        };
        const atRiskCount = await User.countDocuments(atRiskQuery);

        // Onboarding Funnel Logic (Primary/Combined)
        const totalUsers = await User.countDocuments(matchStage);
        const funnelSteps = [
            { label: "Registered", count: totalUsers },
            { label: "Profile Completed", count: await User.countDocuments({ ...matchStage, "onboardingProgress.profileCompleted": true }) },
            { label: "First Brand Viewed", count: await User.countDocuments({ ...matchStage, "onboardingProgress.firstBrandViewed": true }) },
            { label: "First Message Sent", count: await User.countDocuments({ ...matchStage, "onboardingProgress.firstMessageSent": true }) }
        ];

        // Role-Specific funnels for Analytics view
        let influencerFunnel = [];
        let brandFunnel = [];

        influencerFunnel = [
            { label: "Registered", count: await User.countDocuments({ role: "influencer" }) },
            { label: "Profile Completed", count: await User.countDocuments({ role: "influencer", "onboardingProgress.profileCompleted": true }) },
            { label: "First Brand Viewed", count: await User.countDocuments({ role: "influencer", "onboardingProgress.firstBrandViewed": true }) },
            { label: "First Message Sent", count: await User.countDocuments({ role: "influencer", "onboardingProgress.firstMessageSent": true }) }
        ];
        brandFunnel = [
            { label: "Registered", count: await User.countDocuments({ role: "brand" }) },
            { label: "Profile Completed", count: await User.countDocuments({ role: "brand", "onboardingProgress.profileCompleted": true }) },
            { label: "First Brand Viewed", count: await User.countDocuments({ role: "brand", "onboardingProgress.firstBrandViewed": true }) },
            { label: "First Message Sent", count: await User.countDocuments({ role: "brand", "onboardingProgress.firstMessageSent": true }) }
        ];

        res.json({
            funnel: formattedStats,
            atRiskCount,
            combinedFunnel: funnelSteps,
            influencerFunnel,
            brandFunnel
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get detailed user list with filters
exports.getAdminUsers = async (req, res) => {
    try {
        const { status, atRisk, search, role } = req.query;
        let query = { role: { $ne: "admin" } };

        if (role === "influencer" || role === "brand") {
            query.role = role;
        } else {
            query.role = { $in: ["influencer", "brand"] };
        }

        if (status) query.lifecycleStatus = status;
        if (atRisk === "true") {
            query.lastActivityAt = { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) };
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const users = await User.find(query).sort({ lastActivityAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update user status or scores
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        const user = await User.findByIdAndUpdate(userId, updates, { new: true });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add admin note
exports.addAdminNote = async (req, res) => {
    try {
        const { userId } = req.params;
        const { text, adminName } = req.body;

        const user = await User.findById(userId);
        user.adminNotes.push({ text, adminName, createdAt: new Date() });
        await user.save();

        res.json(user.adminNotes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get chronological activity timeline for a user
exports.getUserTimeline = async (req, res) => {
    try {
        const { userId } = req.params;
        const logs = await ActivityLog.find({ userId }).sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Bulk action (e.g., bulk message or status update)
exports.triggerBulkAction = async (req, res) => {
    try {
        const { filter, action, metadata } = req.body;
        // In a real system, this would integrate with a messaging service
        // For now, we update status or log an intervention
        const users = await User.find(filter);

        for (const user of users) {
            if (action === "update_status") {
                user.lifecycleStatus = metadata.newStatus;
                await user.save();
            }
            // Log the intervention
            await logEvent(user._id, "feedback_submitted", { intervention: action, details: metadata });
        }

        res.json({ success: true, count: users.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
