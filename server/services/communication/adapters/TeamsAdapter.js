const CommunicationAdapter = require("../CommunicationAdapter");

class TeamsAdapter extends CommunicationAdapter {
    async sendMessage(userId, data) {
        throw new Error("Teams implementation pending.");
    }

    async readMessages(userId, filter = {}) {
        throw new Error("Teams implementation pending.");
    }
}

module.exports = TeamsAdapter;
