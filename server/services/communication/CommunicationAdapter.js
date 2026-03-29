class CommunicationAdapter {
    /**
     * Send a message through the platform.
     * @param {string} userId - The unique ID of the user sending the message
     * @param {Object} data - Standardized message data (recipients, body, subject, context, etc.)
     * @returns {Promise<Object>} - Object with { success, message, results, etc. }
     */
    async sendMessage(userId, data) {
        throw new Error('Not implemented: sendMessage');
    }

    /**
     * Read messages from the platform.
     * @param {string} userId - The unique ID of the user reading messages
     * @param {Object} [filter] - Optional filter for reading messages
     * @returns {Promise<Array>} - Array of standardized message objects
     */
    async readMessages(userId, filter = {}) {
        throw new Error('Not implemented: readMessages');
    }

    /**
     * Optional method for handling webhooks or push notifications from the platform.
     */
    async handleWebhook(payload) {
        throw new Error('Not implemented: handleWebhook');
    }
}

module.exports = CommunicationAdapter;
