const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const ActivityLog = require("./models/ActivityLog");
const Brand = require("./models/Brand");
const Influencer = require("./models/Influencer");

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("--- DATA SYNC CHECK ---");

        const influencers = await Influencer.countDocuments();
        const brands = await Brand.countDocuments();
        console.log(`Verified Profiles Found: Influencers=${influencers}, Brands=${brands} (Total: ${influencers + brands})`);

        const infWithFlag = await User.countDocuments({ role: 'influencer', "onboardingProgress.profileCompleted": true });
        const brandWithFlag = await User.countDocuments({ role: 'brand', "onboardingProgress.profileCompleted": true });
        console.log(`Users with 'profileCompleted' FLAG: Influencers=${infWithFlag}, Brands=${brandWithFlag}`);

        // Checking for "Silent Completion": User has a profile but flag is false
        const badInf = await Influencer.find({}).select('userId');
        let infReals = 0;
        for (let i of badInf) {
            const u = await User.findById(i.userId);
            if (u && !u.onboardingProgress.profileCompleted) infReals++;
        }
        console.log(`Influencers with REAL profile but MISSING flag: ${infReals}`);

        const badBrand = await Brand.find({}).select('userId');
        let brandReals = 0;
        for (let b of badBrand) {
            const u = await User.findById(b.userId);
            if (u && !u.onboardingProgress.profileCompleted) brandReals++;
        }
        console.log(`Brands with REAL profile but MISSING flag: ${brandReals}`);

        // Activity Logs vs Flags
        const profileLogs = await ActivityLog.aggregate([
            { $match: { eventType: "profile_completed" } },
            { $group: { _id: "$userId" } }
        ]);
        console.log(`Unique users with 'profile_completed' ActivityLog: ${profileLogs.length}`);

        process.exit(0);
    } catch (error) {
        console.error("Sync Check Failed:", error.message);
        process.exit(1);
    }
};

checkData();
