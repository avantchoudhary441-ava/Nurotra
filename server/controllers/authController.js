const User = require("../models/User");
const BrandProfile = require("../models/BrandProfile");
const InfluencerProfile = require("../models/InfluencerProfile");
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

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const uniqueId = Date.now().toString();

        // 1. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 Minutes

        // 2. Create User (Unverified)
        const user = await User.create({
            name,
            email,
            password,
            role,
            uniqueId,
            otp,
            otpExpires,
            isVerified: false
        });

        if (user) {
            // Create empty profile
            if (role === 'brand') await BrandProfile.create({ user: user._id });
            else if (role === 'influencer') await InfluencerProfile.create({ user: user._id });

            // 3. Send OTP Email
            const message = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #6366f1;">Verify Your Email</h2>
                    <p>Hi ${user.name},</p>
                    <p>Thank you for signing up for Nurotra (Collaborator). Please use the code below to verify your email address:</p>
                    <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
                    <p>This code expires in 10 minutes.</p>
                </div>
            `;

            try {
                await sendEmail({
                    email: user.email,
                    subject: "Nurotra - Your Verification Code",
                    message,
                });

                res.status(201).json({
                    message: "User registered. Please check your email for OTP.",
                    email: user.email
                });
            } catch (emailError) {
                console.error("Email send failed:", emailError);
                // We still registered the user, but email failed.
                // Could delete user or just let them resend. Letting them resend is safer.
                res.status(201).json({
                    message: "User registered, but email failed to send. Please try resending OTP.",
                    email: user.email
                });
            }

        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(200).json({ message: "User already verified", token: generateToken(user._id), user });
        }

        if (user.otp === otp && user.otpExpires > Date.now()) {
            user.isVerified = true;
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();

            res.status(200).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                uniqueId: user.uniqueId,
                profileImg: user.profileImg,
                token: generateToken(user._id),
            });
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
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.isVerified) return res.status(400).json({ message: "Account already verified. Please login." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        const message = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #6366f1;">New Verification Code</h2>
                <p>Here is your new verification code:</p>
                <h1 style="font-size: 32px; letter-spacing: 5px; color: #333;">${otp}</h1>
            </div>
        `;

        await sendEmail({
            email: user.email,
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
            // Check verification
            if (user.isVerified === false) {
                // You might want to allow them to login but restrict access, 
                // OR force them to verify. Let's force verify for safety.
                return res.status(403).json({ message: "Email not verified. Please verify your email.", isVerified: false });
            }

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                uniqueId: user.uniqueId,
                profileImg: user.profileImg,
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
