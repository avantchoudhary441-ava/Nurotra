const { google } = require("googleapis");
const User = require("../models/User");

// Helper to create OAuth client
const getOAuthClient = () => {
    // Determine backend URL for callback
    const backendUrl = process.env.NODE_ENV === "production"
        ? "https://nurotra.online" // guessing based on past Nurotra info, or we can use env var
        : "http://localhost:5000";

    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${backendUrl}/api/integrations/gmail/callback`
    );
};

/**
 * GET /api/integrations/gmail/auth
 * Redirects user to Google OAuth screen for Gmail integration.
 */
exports.authGmail = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log(`[GmailAuth] Generating URL for user: ${userId}`);
        const oauth2Client = getOAuthClient();

        const scopes = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send"
        ];

        console.log(`[GmailAuth] Scopes: ${scopes.join(', ')}`);

        // Pass userId in state so we know who is connecting
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent", // Force consent to get refresh token
            scope: scopes,
            state: userId.toString()
        });

        console.log(`[GmailAuth] Success! URL: ${url}`);
        res.json({ success: true, url });
    } catch (error) {
        console.error("Auth Gmail Error:", error);
        res.status(500).json({ success: false, message: "Failed to generate Gmail auth URL", error: error.message });
    }
};

/**
 * GET /api/integrations/gmail/callback
 * Handles the redirect from Google OAuth.
 */
exports.callbackGmail = async (req, res) => {
    const code = req.query.code;
    const userId = req.query.state; // We passed userId in state

    if (!code || !userId) {
        return res.status(400).send("Missing code or state parameter.");
    }

    try {
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        // Update the user
        await User.findByIdAndUpdate(userId, {
            gmailAccessToken: tokens.access_token,
            // Only update refresh token if we received a new one 
            ...(tokens.refresh_token && { gmailRefreshToken: tokens.refresh_token })
        });

        // Redirect back to frontend settings/dashboard
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/dashboard?gmail_connected=true`);
    } catch (error) {
        console.error("Callback Gmail Error:", error);
        res.status(500).send("Authentication failed. Please try again.");
    }
};
