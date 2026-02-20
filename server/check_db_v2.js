const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const roles = await User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
        console.log("Roles:", roles);

        const statusDist = await User.aggregate([{ $group: { _id: "$lifecycleStatus", count: { $sum: 1 } } }]);
        console.log("Lifecycle Statuses:", statusDist);

        const missingStatus = await User.countDocuments({ lifecycleStatus: { $exists: false } });
        console.log(`Users missing lifecycleStatus field: ${missingStatus}`);

        const nullStatus = await User.countDocuments({ lifecycleStatus: null });
        console.log(`Users with null lifecycleStatus: ${nullStatus}`);

        const totalInfluencers = await User.countDocuments({ role: 'influencer' });
        const totalBrands = await User.countDocuments({ role: 'brand' });
        console.log(`Influencers: ${totalInfluencers}, Brands: ${totalBrands}`);

        // Check if stats would match
        const matchStage = { role: { $in: ["influencer", "brand"] } };
        const stats = await User.aggregate([
            { $match: matchStage },
            { $group: { _id: "$lifecycleStatus", count: { $sum: 1 } } }
        ]);
        console.log("Stats that Admin Controller would see:", stats);

        process.exit(0);
    } catch (error) {
        console.error("DB Check Failed:", error.message);
        process.exit(1);
    }
};

checkData();
