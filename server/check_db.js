const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load env
dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const totalUsers = await User.countDocuments();
        console.log(`Total Users in Database: ${totalUsers}`);

        const roles = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);
        console.log("User Roles Distribution:", JSON.stringify(roles, null, 2));

        const lifecycle = await User.aggregate([
            { $group: { _id: "$lifecycleStatus", count: { $sum: 1 } } }
        ]);
        console.log("Lifecycle Status Distribution:", JSON.stringify(lifecycle, null, 2));

        const sample = await User.find({ role: { $ne: "admin" } }).limit(3).select('name email role lifecycleStatus');
        console.log("Sample Users (Non-Admin):", JSON.stringify(sample, null, 2));

        process.exit(0);
    } catch (error) {
        console.error("DB Check Failed:", error.message);
        process.exit(1);
    }
};

checkData();
