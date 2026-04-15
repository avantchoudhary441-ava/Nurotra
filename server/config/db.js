const mongoose = require("mongoose");

const connectDB = async () => {
    const maskedUri = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@') : 'UNDEFINED';
    console.log(`[DB Debug] Connecting to: ${maskedUri}`);
    
    // FAIL FAST: Disable buffering immediately so queries don't hang if connection isn't ready
    mongoose.set('bufferCommands', false);
    
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Reduced from 15s to 5s
            connectTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            family: 4,
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            tls: true,
            directConnection: false
        });
        console.log("✅ MongoDB Connected...");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        console.warn("⚠️  Mongoose buffering is DISABLED. DB operations will fail immediately instead of hanging.");
    }
};

module.exports = connectDB;
