const express = require("express");
const router = express.Router();
const commController = require("../controllers/communicationController");
const { protect } = require("../middleware/authMiddleware");

/**
 * Communication Agent Routes
 * Base: /api/communication
 */

// Main conversational endpoint — all 10 capabilities through chat
router.post("/chat", protect, commController.chat);

// Contacts management
router.get("/contacts", protect, commController.getContacts);
router.post("/contacts", protect, commController.upsertContact);

// Daily digest
router.get("/digest", protect, commController.getDigest);

// Message history
router.get("/history", protect, commController.getHistory);

// Meetings Lifecycle
router.get("/meetings", protect, commController.getMeetings);
router.post("/meetings/sync", protect, commController.syncMeetings);

// Bulk Campaigns
router.get("/campaigns", protect, commController.getCampaigns);
router.get("/campaigns/:id", protect, commController.getCampaignDetail);

// Automation rules
router.get("/rules", protect, commController.getRules);
router.post("/rules", protect, commController.createRule);

// Dynamic Platform Messages (e.g., read email inbox)
router.get("/messages", protect, commController.getPlatformMessages);

// Webhook endpoint for all platforms
router.post("/webhook/:platform", commController.handleWebhook);

module.exports = router;
