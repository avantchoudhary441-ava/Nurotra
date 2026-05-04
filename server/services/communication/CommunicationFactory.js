const EmailAdapter = require('./adapters/EmailAdapter');
const WhatsAppAdapter = require('./adapters/WhatsAppAdapter');
const TeamsAdapter = require('./adapters/TeamsAdapter');
const InstagramAdapter = require('./adapters/InstagramAdapter');
const SMSAdapter = require('./adapters/SMSAdapter');

class CommunicationFactory {
    /**
     * Returns the concrete adapter for the specified platform.
     * @param {string} platform - 'email', 'whatsapp', 'teams', 'instagram', 'sms'
     * @returns {CommunicationAdapter}
     */
    static getService(platform) {
        switch (platform.toLowerCase()) {
            case 'email':
                return new EmailAdapter();
            case 'whatsapp':
                return new WhatsAppAdapter();
            case 'teams':
                return new TeamsAdapter();
            case 'instagram':
                return new InstagramAdapter();
            case 'sms':
                return new SMSAdapter();
            default:
                throw new Error(`Platform ${platform} is not supported.`);
        }
    }
}

module.exports = CommunicationFactory;
