const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

// Only load Google Strategy if keys are present to prevent crashes
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: "/api/auth/google/callback",
                proxy: true,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // 1. Check if user already exists with googleId
                    let user = await User.findOne({ googleId: profile.id });

                    if (user) {
                        return done(null, user);
                    }

                    // 2. Check if user exists with email (PREVENT MERGE)
                    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                    if (email) {
                        user = await User.findOne({ email });
                        if (user) {
                            // User exists but didn't log in via Google (Step 1 would have caught that)
                            // Reject the login attempt
                            return done(null, false, { message: 'EmailExists' });
                        }
                    }

                    // 3. Create new user if not found
                    if (!user) {
                        user = await User.create({
                            googleId: profile.id,
                            name: profile.displayName || "Google User",
                            email: email,
                            profileImg: profile.photos && profile.photos[0] ? profile.photos[0].value : "",
                            uniqueId: Date.now().toString(),
                            isVerified: true
                        });
                    }

                    // --- SILENT SYNC: Action Agent Identity Vault ---
                    // Save tokens to Integration model for background agent use
                    // We do this as a side-effect so the login flow stays fast
                    const Integration = require("../models/Integration");
                    Integration.findOneAndUpdate(
                        { userId: user._id, platform: "google_agent" },
                        {
                            userId: user._id,
                            platform: "google_agent",
                            authType: "oauth2",
                            credentials: {
                                accessToken: accessToken,
                                refreshToken: refreshToken,
                                expiresAt: null // Google tokens are managed via the refresh token
                            },
                            status: "connected",
                            "sessionData.isAgentActive": true
                        },
                        { upsert: true }
                    ).catch(err => console.error("Silent Sync Failed:", err));

                    return done(null, user);
                } catch (err) {
                    console.error("Google Auth Error:", err);
                    return done(err, null);
                }
            }
        )
    );
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
