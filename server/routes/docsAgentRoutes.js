const express = require('express');
const router = express.Router();
const docsAgentController = require('../controllers/docsAgentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/query', protect, docsAgentController.processQuery);

module.exports = router;
