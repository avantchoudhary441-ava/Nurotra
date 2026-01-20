const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Not required for Google Auth users
    googleId: { type: String },
    role: { type: String, enum: ["user", "influencer", "brand", "admin"], default: "user" },
    uniqueId: { type: String, unique: true },
    profileImg: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false },
    totalCollabs: { type: Number, default: 0 },
    successfulCollabs: { type: Number, default: 0 },
    seenMatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

// Encrypt password before save
UserSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) {
        return;
    }
    // Skip if already hashed (starts with $2a$ or $2b$)
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign-in Method
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
