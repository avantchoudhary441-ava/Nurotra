const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const total = await User.countDocuments();
    const roles = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
    const pendingCount = await mongoose.connection.db.collection('pendingusers').countDocuments();

    // Check flags
    const profileDone = await User.countDocuments({ "onboardingProgress.profileCompleted": true });
    const brandViewed = await User.countDocuments({ "onboardingProgress.firstBrandViewed": true });
    const msgSent = await User.countDocuments({ "onboardingProgress.firstMessageSent": true });

    console.log(JSON.stringify({
        total,
        roles,
        pendingCount,
        flags: { profileDone, brandViewed, msgSent }
    }, null, 2));
    process.exit(0);
};
run();
