const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getMe, verifyOtp, resendOtp, testEmail } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.get("/test-email/:email", testEmail);

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
    (req, res, next) => {
        passport.authenticate("google", { session: false }, (err, user, info) => {
            const clientURL = process.env.CLIENT_URL || "http://localhost:5173";

            // Handle Errors (including our custom EmailExists)
            if (err) {
                console.error("Google Auth Error:", err);
                return res.redirect(`${clientURL}/login?error=ServerErr`);
            }

            // Handle "false" user (rejected login)
            if (!user) {
                // If we passed a message in passport.js, use it
                const errorType = info && info.message ? info.message : 'AuthFailed';
                return res.redirect(`${clientURL}/login?error=${errorType}`);
            }

            // Success
            try {
                const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                    expiresIn: "30d",
                });
                res.redirect(`${clientURL}/login?token=${token}`);
            } catch (error) {
                console.error("Token Gen Error:", error);
                res.redirect(`${clientURL}/login?error=TokenError`);
            }
        })(req, res, next);
    }
);



// Get current user
const { protect } = require("../middleware/authMiddleware");
// const { registerUser, loginUser, getMe } = require("../controllers/authController"); // Already imported
router.get("/me", protect, getMe);

module.exports = router;
