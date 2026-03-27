const express = require('express');
const router = express.Router();
const orchestratorController = require('../controllers/orchestratorController');

// Main execution endpoint (Server-Sent Events)
router.post('/execute', orchestratorController.executeTask);

module.exports = router;
