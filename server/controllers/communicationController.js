const communicationService = require("../services/communicationService");
const CommunicationFactory = require("../services/communication/CommunicationFactory");
const Meeting = require("../models/Meeting");
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

/**
 * List Contacts
 * GET /api/communication/contacts
 */
const getContacts = async (req, res) => {
    try {
        const contacts = await Contact.find({
            userId: req.user._id,
            isArchived: false
        }).sort({ "metadata.lastContacted": -1 });

        res.json({ success: true, contacts });
    } catch (error) {
        console.error("[CommController] Contacts error:", error);
        res.status(500).json({ message: "Failed to fetch contacts." });
    }
};

/**
 * Add/Update Contacts
 * POST /api/communication/contacts
 */
const upsertContact = async (req, res) => {
    const { name, email, platform = "email", groups = [] } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required." });
    }

    try {
        const contact = await Contact.findOneAndUpdate(
            { userId: req.user._id, email },
            {
                $set: { name: name || email.split("@")[0], email, platform },
                $addToSet: { groups: { $each: groups } }
            },
            { upsert: true, new: true }
        );

        // AUTO-INGEST into Resource Engine
        const resourceEngineService = require("../services/resourceEngineService");
        await resourceEngineService.autoIngest(
            req.user._id, 
            "contact", 
            { email: contact.email, platform: contact.platform, groups: contact.groups },
            contact.name, 
            contact._id
        );

        res.json({ success: true, contact });
    } catch (error) {
        console.error("[CommController] Upsert contact error:", error);
        res.status(500).json({ message: "Failed to save contact." });
    }
};

/**
 * Get Daily Digest
 * GET /api/communication/digest
 */
const getDigest = async (req, res) => {
    try {
        const result = await communicationService.generateDigest(req.user._id);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[CommController] Digest error:", error);
        res.status(500).json({ message: "Failed to generate digest." });
    }
};

/**
 * Get Message History
 * GET /api/communication/history
 */
const getHistory = async (req, res) => {
    try {
        const { limit = 50, contact } = req.query;
        const query = { userId: req.user._id };

        if (contact) {
            query.recipientEmail = contact;
        }

        const messages = await CommMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate("contactId", "name email");

        res.json({ success: true, messages });
    } catch (error) {
        console.error("[CommController] History error:", error);
        res.status(500).json({ message: "Failed to fetch history." });
    }
};

/**
 * Create Automation Rule
 * POST /api/communication/rules
 */
const createRule = async (req, res) => {
    const { type, name, trigger, action } = req.body;

    if (!type || !name) {
        return res.status(400).json({ message: "Rule type and name are required." });
    }

    try {
        const rule = await CommRule.create({
            userId: req.user._id,
            type,
            name,
            trigger: trigger || {},
            action: action || {}
        });

        res.json({ success: true, rule });
    } catch (error) {
        console.error("[CommController] Rule error:", error);
        res.status(500).json({ message: "Failed to create rule." });
    }
};

/**
 * List Automation Rules
 * GET /api/communication/rules
 */
const getRules = async (req, res) => {
    try {
        const rules = await CommRule.find({
            userId: req.user._id,
            isActive: true
        }).sort({ createdAt: -1 });

        res.json({ success: true, rules });
    } catch (error) {
        console.error("[CommController] List rules error:", error);
        res.status(500).json({ message: "Failed to fetch rules." });
    }
};

/**
 * Fetch messages directly from external platforms via Adapters
 * GET /api/communication/messages?platform=email
 */
const getPlatformMessages = async (req, res) => {
    try {
        const platform = req.query.platform || "email";
        const adapter = CommunicationFactory.getService(platform);
        const messages = await adapter.readMessages(req.user._id, req.query);
        res.json({ success: true, messages });
    } catch (error) {
        console.error(`[CommController] getPlatformMessages error:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * List Meetings
 * GET /api/communication/meetings
 */
const getMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.find({ userId: req.user._id })
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
    getContacts,
    upsertContact,
    getDigest,
    getHistory,
    createRule,
    getRules,
    getPlatformMessages,
    handleWebhook,
    getMeetings,
    syncMeetings,
    getCampaigns,
    getCampaignDetail
};
