const CommunicationAdapter = require("../CommunicationAdapter");
const axios = require("axios");

class WhatsAppAdapter extends CommunicationAdapter {
    constructor() {
        super();
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.baseUrl = `https://graph.facebook.com/v22.0/${this.phoneNumberId}`;
    }

    /**
     * Send a WhatsApp message via Meta Cloud API.
     * @param {string} userId - User ID (unused for now as we use central credentials).
     * @param {object} data - { recipients: [string], body: string }
     */
    async sendMessage(userId, data) {
        const { recipients = [], body } = data;
        const results = [];
        let successCount = 0;

        for (const recipient of recipients) {
            try {
                // Ensure number is in correct format (remove +, spaces, etc.)
                const cleanNumber = recipient.replace(/\D/g, "");

                const response = await axios.post(
                    `${this.baseUrl}/messages`,
                    {
                        messaging_product: "whatsapp",
                        to: cleanNumber,
                        type: "text",
                        text: { body: body }
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${this.accessToken}`,
                            "Content-Type": "application/json"
                        }
                    }
                );

                results.push({ 
                    recipient, 
                    status: "sent", 
                    messageId: response.data.messages[0].id 
                });
                successCount++;
            } catch (error) {
                console.error(`[WhatsAppAdapter] Failed to send to ${recipient}:`, 
                    error.response ? error.response.data : error.message
                );
                results.push({ 
                    recipient, 
                    status: "failed", 
                    error: error.response?.data?.error?.message || error.message || "Unknown error"
                });
            }
        }

        return {
            success: successCount > 0,
            results,
            message: `Sent ${successCount}/${recipients.length} messages.`
        };
    }

    async readMessages(userId, filter = {}) {
        // WhatsApp messages usually come via webhooks, reading history via API is complex
        // and often requires different permissions/endpoints.
        throw new Error("Read messages via API not implemented. Use webhooks for real-time messages.");
    }

    /**
     * Normalizes incoming WhatsApp webhook payload into a standard Nurotra message.
     */
    async handleWebhook(payload) {
        try {
            // Meta sends multiple changes in one webhook call
            const entry = payload.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;

            if (value?.messages?.[0]) {
                const msg = value.messages[0];
                const from = msg.from;
                const text = msg.text?.body || "[Non-text message]";

                return {
                    platform: "whatsapp",
                    sender: from,
                    message: text,
                    timestamp: parseInt(msg.timestamp) * 1000,
                    raw: payload
                };
            }
            return null;
        } catch (error) {
            console.error("[WhatsAppAdapter] Webhook processing failed:", error.message);
            return null;
        }
    }
}

module.exports = WhatsAppAdapter;

