const CommunicationAdapter = require("../CommunicationAdapter");
const { google } = require("googleapis");
const User = require("../../../models/User");

class EmailAdapter extends CommunicationAdapter {
    /**
     * Helper to get an authenticated Gmail client for the user.
     */
    async _getGmailClient(userId) {
        const user = await User.findById(userId);
        if (!user || !user.gmailRefreshToken) {
            throw new Error("Gmail is not connected for this user.");
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.CLIENT_URL // redirect URL
        );

        // Set credentials using the stored refresh token
        oauth2Client.setCredentials({
            refresh_token: user.gmailRefreshToken
        });

        return google.gmail({ version: "v1", auth: oauth2Client });
    }

    /**
     * Converts a utf-8 string to base64url format required by Gmail API.
     */
    _encodeMessage(message) {
        return Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    /**
     * Format the normalized message into a Gmail RFC 2822 standard email.
     */
    _createEmailBody(to, subject, bodyLine) {
        const messageParts = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
            '',
            bodyLine
        ];
        return messageParts.join('\n');
    }

    /**
     * Send email via Gmail API
     */
    async sendMessage(userId, data) {
        const { recipients = [], subject, body } = data;
        const gmail = await this._getGmailClient(userId);

        const results = [];
        let successCount = 0;

        for (const recipient of recipients) {
            try {
                const rawMessage = this._createEmailBody(
                    recipient,
                    subject || "Message from Nurotra",
                    body
                );

                const encodedMessage = this._encodeMessage(rawMessage);

                const res = await gmail.users.messages.send({
                    userId: "me",
                    requestBody: {
                        raw: encodedMessage
                    }
                });

                results.push({ recipient, status: "sent", messageId: res.data.id });
                successCount++;
            } catch (error) {
                console.error(`[EmailAdapter] Failed to send to ${recipient}:`, error.message);
                results.push({ recipient, status: "failed", error: error.message });
            }
        }

        return {
            success: successCount > 0,
            results,
            message: `Sent ${successCount}/${recipients.length} emails.`
        };
    }

    /**
     * Fetch latest messages from Inbox to sync
     */
    async readMessages(userId, filter = { maxResults: 10 }) {
        const gmail = await this._getGmailClient(userId);

        try {
            // First list the message IDs in the inbox
            const listRes = await gmail.users.messages.list({
                userId: "me",
                labelIds: ["INBOX"],
                maxResults: filter.maxResults || 10
            });

            const messages = listRes.data.messages || [];
            const normalizedMessages = [];

            // Fetch full details for each message to map it
            for (const msg of messages) {
                const content = await gmail.users.messages.get({
                    userId: "me",
                    id: msg.id,
                    format: "full"
                });

                const headers = content.data.payload.headers;
                const subject = headers.find(h => h.name.toLowerCase() === "subject")?.value || "";
                const from = headers.find(h => h.name.toLowerCase() === "from")?.value || "";

                // Get plain text body if possible, or snippet
                const bodySnippet = content.data.snippet;

                normalizedMessages.push({
                    platform: "email",
                    sender: from,
                    receiver: userId,
                    subject: subject,
                    message: bodySnippet,
                    timestamp: parseInt(content.data.internalDate)
                });
            }

            return normalizedMessages;
        } catch (error) {
            console.error("[EmailAdapter] Failed to read messages:", error.message);
            throw new Error("Could not read messages from Gmail: " + error.message);
        }
    }
}

module.exports = EmailAdapter;
