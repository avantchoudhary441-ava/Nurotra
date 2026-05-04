const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");
const whatsappController = require("../controllers/whatsappController");
const syncController = require("../controllers/syncController");
const { protect } = require("../middleware/authMiddleware");

// /api/integrations/google/auth - requires user to be logged in
router.get("/google/auth", protect, integrationController.authGmail);

// /api/integrations/google/callback - redirect from Google
router.get("/google/callback", integrationController.callbackGmail);

// /api/integrations/zoom/auth - requires user to be logged in
router.get("/zoom/auth", protect, integrationController.authZoom);

// /api/integrations/zoom/callback - redirect from Zoom
router.get("/zoom/callback", integrationController.callbackZoom);

// --- AGENT IDENTITY ROUTES (New: Dedicated for Action Agent) ---
router.get("/agent/google/auth", protect, integrationController.authGoogleAgent);
router.get("/agent/google/callback", integrationController.callbackGoogleAgent);

// --- SYNC ENGINE ROUTES ---
router.get("/sync/activity", protect, syncController.getSyncActivity);
router.get("/sync/mappings", protect, syncController.getMappings);
router.post("/sync/verify", protect, syncController.verifyMapping);

module.exports = router;
