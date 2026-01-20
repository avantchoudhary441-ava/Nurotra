const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const PendingUserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "influencer", "brand", "admin"], required: true },
    uniqueId: { type: String, unique: true },
    otp: { type: String, required: true },
    otpExpires: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now, index: { expires: '10m' } } // Automatically delete after 10 mins
});

// Encrypt password before save
PendingUserSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model("PendingUser", PendingUserSchema);
