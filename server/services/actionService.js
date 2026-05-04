const { google } = require('googleapis');
const axios = require('axios');

/**
 * Action Service: Handles real-world tool interactions with Error Recovery & Retries.
 */

class ActionService {
    
    /**
     * Helper: Exponential Backoff Retry Wrapper
     */
    async withRetry(fn, attempts = 3, delay = 1000) {
        let lastError;
        for (let i = 0; i < attempts; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                const isRetriable = this.checkIfRetriable(error);
                if (!isRetriable || i === attempts - 1) break;
                
                const wait = delay * Math.pow(2, i);
                console.log(`[ActionService] Attempt ${i + 1} failed. Retrying in ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
        throw lastError;
    }

    checkIfRetriable(error) {
        // Network errors, 5xx server errors, or Rate limits (429) are retriable
        const status = error.response?.status;
        if (!status) return true; // Connection blip
        return status === 429 || (status >= 500 && status <= 599);
    }

    /**
     * Helper: Find Alternative Path (Pivot Logic)
     */
    async handleAlternativePath(tool, error, user, payload) {
        const errorMsg = error.message.toLowerCase();
        
        // Pivot: If specific Google Sheet fails (e.g., Not Found), try finding the last user-updated sheet
        if (tool === 'google sheets' && errorMsg.includes('not found')) {
            console.log(`[ActionService] Pivot: Primary sheet '${payload.spreadsheetId}' not found. Attempting recovery...`);
            // Add automated search or temporary fallback here
        }

        // Pivot: Cross-Tool fallback (Zoom -> Meet)
        if (tool === 'zoom' && (errorMsg.includes('quota') || errorMsg.includes('limit'))) {
            console.log(`[ActionService] Pivot: Zoom quota reached. Switching to Google Meet...`);
            return await this.createGoogleMeet(user, payload);
        }

        throw error; // If no alternative, re-throw for user escalation
    }

    /**
     * Helper: Get Google Auth Client
     */
    getGoogleClient(user) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NODE_ENV === "production" ? "https://nurotra.online" : "http://localhost:5000"}/api/integrations/google/callback`
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        return oauth2Client;
    }

    /**
     * Google Sheets: Add a row to a spreadsheet.
     */
    async addSpreadsheetRow(user, spreadsheetId, range, values) {
        return this.withRetry(async () => {
            const auth = this.getGoogleClient(user);
            const sheets = google.sheets({ version: 'v4', auth });
            try {
                const response = await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: range || 'Sheet1!A1',
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [values] },
                });
                return { success: true, data: response.data, location: range };
            } catch (error) {
                // If it's a non-retriable error (e.g. 404), maybe we can pivot
                if (error.response?.status === 404) {
                    return await this.handleAlternativePath('google sheets', error, user, { spreadsheetId, range, values });
                }
                throw error;
            }
        });
    }

    /**
     * Google Meet: Create a meeting via Calendar API.
     */
    async createGoogleMeet(user, details) {
        return this.withRetry(async () => {
            const auth = this.getGoogleClient(user);
            const calendar = google.calendar({ version: 'v3', auth });
            // ... (rest of the logic remains same, but wrapped in retry)
            const startTime = details.startTime ? new Date(details.startTime).toISOString() : new Date().toISOString();
            const endTime = details.endTime ? new Date(details.endTime).toISOString() : new Date(Date.now() + 3600000).toISOString();

            const event = {
                summary: details.summary || 'Nurotra Meeting',
                description: details.description || 'Scheduled via Nurotra Action Agent',
                start: { dateTime: startTime, timeZone: 'UTC' },
                end: { dateTime: endTime, timeZone: 'UTC' },
                conferenceData: {
                    createRequest: {
                        requestId: `nurotra-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                },
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                conferenceDataVersion: 1,
            });
            return {
                success: true,
                joinUrl: response.data.hangoutLink,
                meetingId: response.data.id,
                type: 'meeting',
                provider: 'meet'
            };
        });
    }

    /**
     * Zoom: Refresh OAuth Token
     */
    async refreshZoomToken(user) {
        if (!user.zoomRefreshToken) {
            throw new Error("Zoom is not connected. Please go to Integrations to connect your account.");
        }

        try {
            console.log(`[ActionService] Refreshing Zoom token for user: ${user._id}`);
            const auth = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');
            const response = await axios.post('https://zoom.us/oauth/token', null, {
                params: {
                    grant_type: 'refresh_token',
                    refresh_token: user.zoomRefreshToken
                },
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const User = require("../models/User");
            const updatedUser = await User.findByIdAndUpdate(user._id, {
                zoomAccessToken: response.data.access_token,
                zoomRefreshToken: response.data.refresh_token
            }, { new: true });

            return updatedUser;
        } catch (error) {
            console.error(`[ActionService] Zoom Refresh Failed:`, error.response?.data || error.message);
            throw new Error("Failed to refresh Zoom credentials. Please reconnect Zoom.");
        }
    }

    /**
     * Zoom: Create a meeting using Zoom API.
     */
    async createZoomMeeting(user, details) {
        return this.withRetry(async () => {
            try {
                const startTime = details.startTime ? new Date(details.startTime).toISOString() : new Date().toISOString();
                
                const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', {
                    topic: details.summary || details.title || 'Nurotra Zoom Meeting',
                    type: 2,
                    start_time: startTime,
                    duration: details.duration || 60,
                    settings: { 
                        join_before_host: true, 
                        waiting_room: false,
                        meeting_authentication: false
                    }
                }, {
                    headers: { 
                        Authorization: `Bearer ${user.zoomAccessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                return {
                    success: true,
                    joinUrl: response.data.join_url,
                    meetingId: response.data.id,
                    passcode: response.data.password,
                    type: 'meeting',
                    provider: 'zoom'
                };
            } catch (error) {
                // If UNAUTHORIZED (401), try refreshing token ONCE
                if (error.response?.status === 401 && !details._isRetrying) {
                    console.log(`[ActionService] Zoom Token Expired. Attempting silent refresh...`);
                    const refreshedUser = await this.refreshZoomToken(user);
                    return await this.createZoomMeeting(refreshedUser, { ...details, _isRetrying: true });
                }

                // If it's a quota or limit issue, pivot to Google Meet
                if (error.response?.status === 429 || error.response?.status === 403) {
                     return await this.handleAlternativePath('zoom', error, user, details);
                }
                throw error;
            }
        });
    }

    /**
     * Dispatcher: Executes a specific tool action based on intent.
     */
    async executeToolAction(user, actionIntent) {
        const { tool, operation, payload } = actionIntent;
        
        switch (tool.toLowerCase()) {
            case 'google sheets':
                return await this.addSpreadsheetRow(user, payload.spreadsheetId, payload.range, payload.values);
            
            case 'google meet':
                return await this.createGoogleMeet(user, payload);
            
            case 'zoom':
                return await this.createZoomMeeting(user, payload);
                
            default:
                throw new Error(`Tool '${tool}' is not yet integrated.`);
        }
    }
}

module.exports = new ActionService();
