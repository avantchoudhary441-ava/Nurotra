const { google } = require('googleapis');

/**
 * Google Calendar Service
 * Handles autonomous meeting creation and management via Google Calendar API.
 */
class GoogleCalendarService {
    
    /**
     * Get authenticated Calendar client for a user
     */
    getCalendarClient(user) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NODE_ENV === "production" ? "https://nurotra.online" : "http://localhost:5000"}/api/integrations/google/callback`
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        return google.calendar({ version: 'v3', auth: oauth2Client });
    }

    /**
     * Create a Google Meet meeting
     * @param {Object} user 
     * @param {Object} meetingInfo - { title, description, startTime, endTime, attendees }
     */
    async createMeeting(user, meetingInfo) {
        try {
            console.log(`[CalendarService] Creating meeting: ${meetingInfo.title}`);
            const calendar = this.getCalendarClient(user);

            const event = {
                summary: meetingInfo.title,
                description: meetingInfo.description,
                start: {
                    dateTime: meetingInfo.startTime || new Date().toISOString(),
                    timeZone: 'UTC',
                },
                end: {
                    dateTime: meetingInfo.endTime || new Date(Date.now() + 30 * 60000).toISOString(), // +30 mins
                    timeZone: 'UTC',
                },
                attendees: (meetingInfo.attendees || []).map(email => ({ email })),
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

            console.log(`[CalendarService] Meeting created successfully.`);
            
            return {
                id: response.data.id,
                link: response.data.hangoutLink,
                status: response.data.status,
                htmlLink: response.data.htmlLink
            };
        } catch (error) {
            console.error(`[CalendarService] Meeting creation failed:`, error.message);
            throw error;
        }
    }
}

module.exports = new GoogleCalendarService();
