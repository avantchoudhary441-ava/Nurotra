const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");
const whatsappController = require("../controllers/whatsappController");
const { protect } = require("../middleware/authMiddleware");

// /api/integrations/google/auth - requires user to be logged in
router.get("/google/auth", protect, integrationController.authGmail);

// /api/integrations/google/callback - redirect from Google
router.get("/google/callback", integrationController.callbackGmail);

// /api/integrations/zoom/auth - requires user to be logged in
router.get("/zoom/auth", protect, integrationController.authZoom);

// /api/integrations/zoom/callback - redirect from Zoom
router.get("/zoom/callback", integrationController.callbackZoom);

module.exports = router;
