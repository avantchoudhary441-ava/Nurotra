const express = require('express');
const router = express.Router();
const actionController = require('../controllers/actionController');
const { protect } = require('../middleware/authMiddleware');

/**
 * /api/actions
 */

// Execute a tool-specific action
router.post('/execute', protect, actionController.executeAction);

// Get current status of all integrations
router.get('/status', protect, actionController.getIntegrationStatus);

module.exports = router;
