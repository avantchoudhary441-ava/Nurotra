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

                    // 2. Check if user exists with email (merge accounts)
                    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                    if (email) {
                        user = await User.findOne({ email });
                        if (user) {
                            // Update user with googleId for future logins
                            user.googleId = profile.id;
                            if (!user.profileImg && profile.photos && profile.photos[0]) {
                                user.profileImg = profile.photos[0].value;
                            }
                            await user.save();
                            return done(null, user);
                        }
                    }

                    // 3. Create new user if not found
                    user = await User.create({
                        googleId: profile.id,
                        name: profile.displayName || "Google User",
                        email: email,
                        profileImg: profile.photos && profile.photos[0] ? profile.photos[0].value : "",
                        uniqueId: Date.now().toString(), // Generate simplified ID
                        isVerified: true
                    });

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
