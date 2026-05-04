const { google } = require("googleapis");
const User = require("../models/User");

// Helper to create OAuth client
// Determine backend URL for callback
const getBackendUrl = () => process.env.NODE_ENV === "production"
    ? "https://nurotra.online"
    : "http://localhost:5000";

const getOAuthClient = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${getBackendUrl()}/api/integrations/google/callback`
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
        console.log(`[GmailAuth] Redirect URI: ${oauth2Client.redirectUri}`);

        const scopes = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events"
        ];

        console.log(`[GmailAuth] Scopes: ${scopes.join(', ')}`);

        // Pass userId in state so we know who is connecting
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent", // Force consent to get refresh token
            scope: scopes,
            state: userId.toString()
        });

        console.log(`[GmailAuth] Success! Returning URL...`);
        res.json({ url });
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
        oauth2Client.setCredentials(tokens);

        // Fetch user email from Google
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        const gmailEmail = profile.data.emailAddress;

        // Update the user
        await User.findByIdAndUpdate(userId, {
            gmailAccessToken: tokens.access_token,
            gmailEmail: gmailEmail,
            // Only update refresh token if we received a new one 
            ...(tokens.refresh_token && { gmailRefreshToken: tokens.refresh_token })
        });

        // Redirect back to frontend settings/dashboard
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/dashboard?gmail_connected=true`);
    } catch (error) {
        const fs = require('fs');
        const logPath = 'c:\\Users\\hp\\OneDrive\\Desktop\\Nurotra\\server\\gmail_debug.log';
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Callback Gmail Error: ${error.stack || error.message}\n`);
        console.error("Callback Gmail Error:", error);
        res.status(500).send("Authentication failed. Please try again.");
    }
};

/**
 * Zoom Integration Logic
 */
exports.authZoom = (req, res) => {
    const userId = req.user._id;
    const redirectUri = `${getBackendUrl()}/api/integrations/zoom/callback`;
    const url = `https://zoom.us/oauth/authorize?response_type=code&client_id=${process.env.ZOOM_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
    res.redirect(url);
};

exports.callbackZoom = async (req, res) => {
    const { code, state: userId } = req.query;
    if (!code) return res.status(400).send("No code provided.");

    try {
        const redirectUri = `${getBackendUrl()}/api/integrations/zoom/callback`;
        const auth = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');

        const axios = require("axios"); 
        const response = await axios.post('https://zoom.us/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri
            },
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        await User.findByIdAndUpdate(userId, {
            zoomAccessToken: response.data.access_token,
            zoomRefreshToken: response.data.refresh_token
        });

        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/dashboard?zoom_connected=true`);
    } catch (error) {
        console.error("Zoom Callback Error:", error.response?.data || error.message);
        res.status(500).send("Zoom Authentication failed.");
    }
};

/**
 * Action Agent: Google Auth
 * Specialized flow to secure a Refresh Token for the Browser Agent.
 */
exports.authGoogleAgent = async (req, res) => {
    try {
        const userId = req.user._id;
        const oauth2Client = getOAuthClient();

        // Standard profile scopes + offline access for background persistence
        const scopes = ["profile", "email"];

        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent", 
            scope: scopes,
            state: userId.toString()
        });

        res.json({ url });
    } catch (error) {
        console.error("Auth Google Agent Error:", error);
        res.status(500).json({ success: false, message: "Agent auth failed." });
    }
};

/**
 * Action Agent: Google Callback
 * Saves tokens specifically to the Integration model (Identity Vault).
 */
exports.callbackGoogleAgent = async (req, res) => {
    const { code, state: userId } = req.query;
    const Integration = require("../models/Integration");

    try {
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        // Store in the specialized Identity Vault (Integration model)
        // NOT interfering with the core User collection
        await Integration.findOneAndUpdate(
            { userId, platform: "google_agent" },
            {
                userId,
                platform: "google_agent",
                authType: "oauth2",
                credentials: {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null
                },
                status: "connected",
                "sessionData.isAgentActive": true
            },
            { upsert: true, new: true }
        );

        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        res.redirect(`${clientUrl}/dashboard?agent_synced=google`);
    } catch (error) {
        console.error("Callback Google Agent Error:", error);
        res.status(500).send("Agent sync failed.");
    }
};
