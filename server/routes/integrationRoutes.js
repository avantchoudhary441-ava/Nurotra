const express = require("express");
const router = express.Router();
const integrationController = require("../controllers/integrationController");
const { protect } = require("../middleware/authMiddleware");

// /api/integrations/gmail/auth - requires user to be logged in
router.get("/gmail/auth", protect, integrationController.authGmail);

// /api/integrations/gmail/callback - does not require authMiddleware as it's a redirect from Google
// The user identity is passed via the state param
router.get("/gmail/callback", integrationController.callbackGmail);

module.exports = router;
