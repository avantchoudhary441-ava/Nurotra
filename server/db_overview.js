const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const ActivityLog = require("./models/ActivityLog");

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("--- DATABASE OVERVIEW ---");

        // 1. All Registered Users
        const allUsers = await User.find({});
        console.log(`Total Verified Users (All Roles): ${allUsers.length}`);

        const roles = await User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
        console.log("Roles Distribution:", roles);

        // 2. Pending Users (Unverified)
        let pendingCount = 0;
        try {
            const pending = await mongoose.connection.db.collection('pendingusers').countDocuments();
            pendingCount = pending;
            console.log(`Total Pending (Unverified) Users: ${pendingCount}`);
        } catch (e) { console.log("PendingUsers collection not found"); }

        // 3. Activity Logs Breakdown
        const logCount = await ActivityLog.countDocuments();
        console.log(`Total Activity Logs: ${logCount}`);

        const logTypes = await ActivityLog.aggregate([{ $group: { _id: "$eventType", count: { $sum: 1 } } }]);
        console.log("Log Types Distribution:", logTypes);

        // 4. Checking "First Brand Viewed" discrepancy
        const viewers = await User.countDocuments({ "onboardingProgress.firstBrandViewed": true });
        console.log(`Users with 'firstBrandViewed' flag: ${viewers}`);

        const viewLogs = await ActivityLog.countDocuments({ eventType: "brand_viewed" });
        console.log(`Activity Logs of type 'brand_viewed': ${viewLogs}`);

        // 5. Checking "First Message Sent" discrepancy
        const messengers = await User.countDocuments({ "onboardingProgress.firstMessageSent": true });
        console.log(`Users with 'firstMessageSent' flag: ${messengers}`);

        const msgLogs = await ActivityLog.countDocuments({ eventType: "message_sent" });
        console.log(`Activity Logs of type 'message_sent': ${msgLogs}`);

        process.exit(0);
    } catch (error) {
        console.error("DB Overview Failed:", error.message);
        process.exit(1);
    }
};

checkData();
