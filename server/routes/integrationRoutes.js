const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");
const whatsappController = require("../controllers/whatsappController");
const syncController = require("../controllers/syncController");
const { protect } = require("../middleware/authMiddleware");

// /api/integrations/gmail/auth - requires user to be logged in
router.get("/gmail/auth", protect, integrationController.authGmail);

// /api/integrations/whatsapp/webhook - Public for Meta
router.get("/whatsapp/webhook", whatsappController.verifyWebhook);
router.post("/whatsapp/webhook", whatsappController.handleWebhookPayload);

// /api/integrations/gmail/callback - does not require authMiddleware as it's a redirect from Google
// The user identity is passed via the state param
router.get("/gmail/callback", integrationController.callbackGmail);

// --- SYNC ENGINE ROUTES ---
router.get("/sync/activity", protect, syncController.getSyncActivity);
router.get("/sync/mappings", protect, syncController.getMappings);
router.post("/sync/verify", protect, syncController.verifyMapping);

module.exports = router;
