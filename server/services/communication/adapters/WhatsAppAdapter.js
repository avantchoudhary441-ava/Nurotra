const CommunicationAdapter = require("../CommunicationAdapter");

class WhatsAppAdapter extends CommunicationAdapter {
    async sendMessage(userId, data) {
        throw new Error("WhatsApp implementation pending.");
    }

    async readMessages(userId, filter = {}) {
        throw new Error("WhatsApp implementation pending.");
    }

    async handleWebhook(payload) {
        // Handle incoming WhatsApp business API webhook 
        throw new Error("WhatsApp webhook not implemented.");
    }
}

module.exports = WhatsAppAdapter;
