const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const User = require("../models/User"); // Adjust path if needed
const Brand = require("../models/Brand"); // Adjust path if needed
const Influencer = require("../models/Influencer"); // Adjust path if needed
const connectDB = require("../config/db");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

const emailsToDelete = [
    "tanuj1284@gmail.com"
];

const deleteUsers = async () => {
    try {
        await connectDB();

        console.log("Connected to DB. Starting deletion process...");

        for (const email of emailsToDelete) {
            const user = await User.findOne({ email });

            if (!user) {
                console.log(`User not found: ${email}`);
                continue;
            }

            console.log(`Found user: ${email} (ID: ${user._id}, Role: ${user.role})`);

            // Delete associated profiles based on role or just check both to be safe
            // Cascading delete manually
            const brandDelete = await Brand.deleteMany({ userId: user._id });
            if (brandDelete.deletedCount > 0) {
                console.log(`  - Deleted ${brandDelete.deletedCount} Brand profile(s)`);
            }

            const influencerDelete = await Influencer.deleteMany({ userId: user._id });
            if (influencerDelete.deletedCount > 0) {
                console.log(`  - Deleted ${influencerDelete.deletedCount} Influencer profile(s)`);
            }

            // Delete the user
            await User.deleteOne({ _id: user._id });
            console.log(`  - Deleted User document for ${email}`);
        }

        console.log("Deletion process completed.");
        process.exit(0);
    } catch (err) {
        console.error("Error deleting users:", err);
        process.exit(1);
    }
};

deleteUsers();
