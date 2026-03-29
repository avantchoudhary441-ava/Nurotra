const CommunicationAdapter = require("../CommunicationAdapter");

class InstagramAdapter extends CommunicationAdapter {
    async sendMessage(userId, data) {
        throw new Error("Instagram implementation pending.");
    }

    async readMessages(userId, filter = {}) {
        throw new Error("Instagram implementation pending.");
    }
}

module.exports = InstagramAdapter;
