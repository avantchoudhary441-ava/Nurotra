const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

/**
 * Logs a user event and updates user-specific status tracking.
 * @param {string} userId - The ID of the user.
 * @param {string} eventType - The type of event (from ActivityLog enum).
 * @param {Object} metadata - Optional additional data.
 */
const logEvent = async (userId, eventType, metadata = {}) => {
    try {
        // 1. Create the activity log entry
        await ActivityLog.create({
            userId,
            eventType,
            metadata
        });

        // 2. Update the user's last activity and onboarding progress
        const updateFields = {
            lastActivityAt: new Date()
        };

        // Auto-update onboarding steps based on events
        if (eventType === "profile_completed") {
            updateFields["onboardingProgress.profileCompleted"] = true;
            updateFields.lifecycleStatus = "onboarded";
        } else if (eventType === "brand_viewed") {
            updateFields["onboardingProgress.firstBrandViewed"] = true;
            // Only move to brand_viewed if they were activated or onboarded
            updateFields.lifecycleStatus = "brand_viewed";
        } else if (eventType === "message_drafted") {
            updateFields["onboardingProgress.firstMessageDrafted"] = true;
        } else if (eventType === "message_sent") {
            updateFields["onboardingProgress.firstMessageSent"] = true;
            updateFields.lifecycleStatus = "outreach_sent";
        } else if (eventType === "message_received") {
            updateFields.lifecycleStatus = "brand_responded";
        } else if (eventType === "collab_started") {
            updateFields.lifecycleStatus = "collab_in_progress";
        } else if (eventType === "collab_completed") {
            updateFields.lifecycleStatus = "collab_completed";
        }

        await User.findByIdAndUpdate(userId, { $set: updateFields });

    } catch (error) {
        console.error(`Failed to log event ${eventType} for user ${userId}:`, error.message);
    }
};

module.exports = { logEvent };
