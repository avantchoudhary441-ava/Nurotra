require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const BrandProfile = require("../models/BrandProfile");
const InfluencerProfile = require("../models/InfluencerProfile");

const deleteUser = async () => {
    try {
        await connectDB();

        const email = process.argv[2];

        if (!email) {
            console.error("Please provide an email address.");
            console.error("Usage: node scripts/deleteUser.js <email>");
            process.exit(1);
        }

        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User with email ${email} not found.`);
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (${user.email}) [${user.role}]`);

        // Delete associated profile
        if (user.role === 'brand') {
            const result = await BrandProfile.deleteOne({ user: user._id });
            console.log(`Deleted Brand Profile: ${result.deletedCount}`);
        } else if (user.role === 'influencer') {
            const result = await InfluencerProfile.deleteOne({ user: user._id });
            console.log(`Deleted Influencer Profile: ${result.deletedCount}`);
        }

        // Delete User
        await User.deleteOne({ _id: user._id });
        console.log("User deleted successfully.");

        process.exit();
    } catch (err) {
        console.error("Error deleting user:", err);
        process.exit(1);
    }
};

deleteUser();
