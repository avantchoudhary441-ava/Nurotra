const CommunicationAdapter = require("../CommunicationAdapter");

class SMSAdapter extends CommunicationAdapter {
    async sendMessage(userId, data) {
        throw new Error("SMS implementation pending (Twilio).");
    }

    async readMessages(userId, filter = {}) {
        throw new Error("SMS implementation pending.");
    }
}

module.exports = SMSAdapter;
