const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getMe, verifyOtp, resendOtp } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Google Auth
const passport = require("passport");
const jwt = require("jsonwebtoken");

// 1. Redirect to Google
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// 2. Callback from Google
router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/login", session: false }),
    (req, res) => {
        // Generate JWT
        const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
            expiresIn: "30d",
        });

        // Redirect to Frontend with Token
        // In production, use client URL from env
        const clientURL = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientURL}/login?token=${token}`);
    }
);



// Get current user
const { protect } = require("../middleware/authMiddleware");
// const { registerUser, loginUser, getMe } = require("../controllers/authController"); // Already imported
router.get("/me", protect, getMe);

module.exports = router;
