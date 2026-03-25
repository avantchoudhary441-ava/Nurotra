const express = require('express');
const router = express.Router();
const timeAgentController = require('../controllers/timeAgentController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Time Agent Planning
 * Route: POST /api/time-agent/plan
 */
router.post('/plan', protect, timeAgentController.planTask);

module.exports = router;
