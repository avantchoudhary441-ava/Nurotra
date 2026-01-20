const User = require("../models/User");
const Brand = require("../models/Brand");
const Influencer = require("../models/Influencer");
const PendingUser = require("../models/PendingUser");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// @desc    Register new user & Send OTP
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        if (role === "admin") {
            return res.status(403).json({ message: "Admin registration is restricted." });
        }

        // 1. Check if user is already in the main collection (Verified)
        const userExists = await User.findOne({ email });
        if (userExists && userExists.isVerified) {
            return res.status(400).json({ message: "User already exists" });
        }

        // 2. Clean up "ghost" users from previous system (Unverified records in main User collection)
        if (userExists && !userExists.isVerified) {
            // This cleans up the mess from the previous implementation
            await User.deleteOne({ _id: userExists._id });
            await Brand.deleteOne({ userId: userExists._id });
            await Influencer.deleteOne({ userId: userExists._id });
        }

        // 3. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 Minutes

        // 4. Save to PendingUser collection (Temporary)
        // Upsert so if they try again, we just restart the timer and update the info
        const uniqueId = Date.now().toString();
        const pendingUser = await PendingUser.findOneAndUpdate(
            { email },
            { name, email, password, role, uniqueId, otp, otpExpires, createdAt: Date.now() },
            { upsert: true, new: true }
        );

        if (pendingUser) {
            // 5. Send OTP Email
            const message = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #6366f1;">Verify Your Email</h2>
                    <p>Hi ${pendingUser.name},</p>
                    <p>Thank you for signing up for Nurotra. Please use the code below to verify your email address:</p>
                    <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
                    <p>This code expires in 10 minutes.</p>
                </div>
            `;

            try {
                await sendEmail({
                    email: pendingUser.email,
                    subject: "Nurotra - Your Verification Code",
                    message,
                });

                res.status(201).json({
                    message: "OTP sent to your email. Please verify to complete registration.",
                    email: pendingUser.email
                });
            } catch (emailError) {
                console.error("Email send failed:", emailError);
                res.status(201).json({
                    message: "Registration recorded, but email failed to send. Please try resending OTP.",
                    email: pendingUser.email
                });
            }
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify OTP & Commit User
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        // 1. Check main User collection (in case already verified)
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isVerified) {
            return res.status(200).json({ message: "User already verified", token: generateToken(existingUser._id), user: existingUser });
        }

        // 2. Check PendingUser collection
        const pendingUser = await PendingUser.findOne({ email });

        if (!pendingUser) {
            return res.status(404).json({ message: "No pending registration found for this email. Please sign up again." });
        }

        if (pendingUser.otp === otp && pendingUser.otpExpires > Date.now()) {
            // 3. Move data to main collections (Real Registration)
            const newUser = await User.create({
                name: pendingUser.name,
                email: pendingUser.email,
                password: pendingUser.password, // This will be RE-HASHED by User model's pre-save hook?
                // Wait, if password was already hashed in PendingUser (if we used a hook there), 
                // we should be careful. But User.js has a pre-save hook.
                role: pendingUser.role,
                uniqueId: pendingUser.uniqueId,
                isVerified: true
            });

            if (newUser) {
                // Create profiles
                if (newUser.role === 'brand') {
                    await Brand.create({
                        userId: newUser._id,
                        nuroId: newUser.uniqueId,
                        website: "https://pending",
                        contact: newUser.email
                    });
                } else if (newUser.role === 'influencer') {
                    await Influencer.create({
                        userId: newUser._id,
                        nuroId: newUser.uniqueId,
                        email: newUser.email,
                        primaryPlatform: "Other",
                        platformUrl: "https://pending",
                        followers: "Pending"
                    });
                }

                // 4. Delete pending record
                await PendingUser.deleteOne({ _id: pendingUser._id });

                res.status(200).json({
                    _id: newUser._id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    uniqueId: newUser.uniqueId,
                    profileImg: newUser.profileImg,
                    totalCollabs: 0,
                    successfulCollabs: 0,
                    token: generateToken(newUser._id),
                });
            }
        } else {
            res.status(400).json({ message: "Invalid or expired OTP" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOtp = async (req, res) => {
    const { email } = req.body;
    try {
        // Only resend if they are in Pending collection
        const pendingUser = await PendingUser.findOne({ email });

        if (!pendingUser) {
            const user = await User.findOne({ email });
            if (user && user.isVerified) {
                return res.status(400).json({ message: "Account already verified. Please login." });
            }
            return res.status(404).json({ message: "No pending registration found. Please sign up again." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        pendingUser.otp = otp;
        pendingUser.otpExpires = Date.now() + 10 * 60 * 1000;
        pendingUser.createdAt = Date.now(); // Reset TTL
        await pendingUser.save();

        const message = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #6366f1;">New Verification Code</h2>
                <p>Here is your new verification code:</p>
                <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
            </div>
        `;

        await sendEmail({
            email: pendingUser.email,
            subject: "Nurotra - Resend Verification Code",
            message,
        });

        res.status(200).json({ message: "OTP resent successfully" });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            // With the new system, only verified users exist in the User collection
            // but we keep the check for backward compatibility/safety
            if (user.isVerified === false) {
                return res.status(403).json({ message: "Email not verified. Please verify your email.", isVerified: false });
            }

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                uniqueId: user.uniqueId,
                profileImg: user.profileImg,
                totalCollabs: user.totalCollabs || 0,
                successfulCollabs: user.successfulCollabs || 0,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            uniqueId: user.uniqueId,
            profileImg: user.profileImg,
            totalCollabs: user.totalCollabs || 0,
            successfulCollabs: user.successfulCollabs || 0,
            token: req.headers.authorization.split(" ")[1] // Echo back token or just rely on client having it
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Test Email Sending (Resend)
// @route   GET /api/auth/test-email/:email
// @access  Public
const testEmail = async (req, res) => {
    const { email } = req.params;

    try {
        console.log(`Debug: Sending test email to ${email} via Resend...`);

        // Use the sendEmail utility which now uses Resend
        const result = await sendEmail({
            email,
            subject: "Resend API Test",
            message: "<h1>It Works!</h1><p>This is a test email sent via Resend API from your Nurotra app.</p>"
        });

        res.status(200).json({
            message: "Test email sent successfully via Resend",
            result
        });
    } catch (error) {
        console.error("Test Email Failed:", error);
        res.status(500).json({
            message: "Test email failed",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = { registerUser, loginUser, getMe, verifyOtp, resendOtp, testEmail };
