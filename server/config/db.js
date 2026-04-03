const mongoose = require("mongoose");

const connectDB = async () => {
    const maskedUri = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@') : 'UNDEFINED';
    console.log(`[DB Debug] Connecting to: ${maskedUri}`);
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            family: 4,
            directConnection: false
        });
        console.log("✅ MongoDB Connected...");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        // If it fails with the "Servers not found" error, it's often DNS or SSL
        if (err.message.includes("Could not connect")) {
            console.error("💡 Tip: Standard driver worked in test_db.js. This could be a Mongoose-specific DNS resolution issue.");
        }
    }
};

module.exports = connectDB;
