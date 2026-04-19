const communicationService = require("../services/communicationService");
const CommunicationFactory = require("../services/communication/CommunicationFactory");
const MeetingModel = require("../models/Meeting");
const BulkCampaign = require("../models/BulkCampaign");
const Contact = require("../models/Contact");
const CommMessage = require("../models/CommMessage");
const CommRule = require("../models/CommRule");
const learningService = require("../services/learningService");

/**
 * Main Conversational Endpoint
 * POST /api/communication/chat
 * All 10 capabilities are accessed through natural language here.
 */
const chat = async (req, res) => {
    const { prompt, history = [] } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: "Prompt is required." });
    }

    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

        const result = await communicationService.processMessage(userId, prompt, history);

        // TRIGGER LEARNING: Analyze the interaction in the background
        const fullConversation = [...history, { role: "user", content: prompt }, { role: "assistant", content: result.message }];
        learningService.analyzeInteraction(userId, fullConversation).catch(err => 
            console.error("[CommController] Learning Trigger failed:", err)
        );

        res.json({
            success: true,
            intent: result.intent,
            message: result.message,
            action: result.action,
            // Compatibility with useAgentChat's content filter
            content: [{ type: "text", text: result.message }]
        });
    } catch (error) {
        console.error("[CommController] Chat error:", error.stack || error);
        res.status(500).json({
            message: "Communication Agent encountered an error.",
            error: error.message
        });
    }
};


const getContacts = async (req, res) => {
    try {
        const userId = req.user?._id;
        const contacts = await Contact.find({ userId }).sort({ name: 1 });
        res.json({ success: true, contacts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getHistory = async (req, res) => {
    try {
        const userId = req.user?._id;
        const messages = await CommMessage.find({ userId }).sort({ timestamp: -1 }).limit(50);
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getRules = async (req, res) => {
    try {
        const userId = req.user?._id;
        const rules = await CommRule.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, rules });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleRule = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await CommRule.findById(id);
        if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
        rule.enabled = !rule.enabled;
        await rule.save();
        res.json({ success: true, rule });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteRule = async (req, res) => {
    try {
        const { id } = req.params;
        await CommRule.findByIdAndDelete(id);
        res.json({ success: true, message: "Rule deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const userId = req.user?._id;
        const messages = await CommMessage.find({ userId });
        const analytics = {
            totalMessages: messages.length,
            inbound: messages.filter(m => m.direction === 'inbound').length,
            outbound: messages.filter(m => m.direction === 'outbound').length,
            byChannel: messages.reduce((acc, m) => {
                acc[m.channel] = (acc[m.channel] || 0) + 1;
                return acc;
            }, {})
        };
        res.json({ success: true, analytics });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * List Meetings
 * GET /api/communication/meetings
 */
const getMeetings = async (req, res) => {
    try {
        const meetings = await MeetingModel.find({ userId: req.user._id })
            .sort({ startTime: 1 });
        res.json({ success: true, meetings });
    } catch (error) {
        console.error("[CommController] Meetings error:", error);
        res.status(500).json({ message: "Failed to fetch meetings." });
    }
};

/**
 * Trigger Lifecycle Sync
 * POST /api/communication/meetings/sync
 */
const syncMeetings = async (req, res) => {
    try {
        const result = await communicationService.syncMeetingLifecycle(req.user._id);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[CommController] Sync error:", error);
        res.status(500).json({ message: "Failed to sync meetings." });
    }
};

/**
 * List Bulk Campaigns
 * GET /api/communication/campaigns
 */
const getCampaigns = async (req, res) => {
    try {
        const campaigns = await BulkCampaign.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        res.json({ success: true, campaigns });
    } catch (error) {
        console.error("[CommController] Campaigns error:", error);
        res.status(500).json({ message: "Failed to fetch campaigns." });
    }
};

/**
 * Get Campaign Detail with individual messages
 * GET /api/communication/campaigns/:id
 */
const getCampaignDetail = async (req, res) => {
    try {
        const campaign = await BulkCampaign.findOne({ _id: req.params.id, userId: req.user._id });
        if (!campaign) return res.status(404).json({ message: "Campaign not found." });

        const messages = await CommMessage.find({ campaignId: campaign._id })
            .populate("contactId", "name email");

        res.json({ success: true, campaign, messages });
    } catch (error) {
        console.error("[CommController] Campaign detail error:", error);
        res.status(500).json({ message: "Failed to fetch campaign details." });
    }
};

/**
 * Central Webhook Handler for all platforms 
 * POST /api/communication/webhook/:platform
 */
const handleWebhook = async (req, res) => {
    const platform = req.params.platform;
    try {
        const adapter = CommunicationFactory.getService(platform);
        await adapter.handleWebhook(req.body);
        res.status(200).send("Webhook received");
    } catch (error) {
        console.error(`[CommController] Webhook error for ${platform}:`, error);
        res.status(200).send("Ignored or Error");
    }
};

module.exports = {
    chat,
    getCampaigns,
    getContacts,
    getHistory,
    getRules,
    toggleRule,
    deleteRule,
    getAnalytics,
    getMeetings,
    syncMeetings,
    getCampaignDetail,
    handleWebhook
};
