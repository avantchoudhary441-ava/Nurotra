const express = require('express');
const router = express.Router();
const nuroController = require('../controllers/nuroController');
const { protect } = require('../middleware/authMiddleware');

router.get('/memory', protect, nuroController.getNuroMemory);
router.get('/memory/:userId', protect, nuroController.getPublicNuroMemory);
router.post('/analyze', protect, nuroController.runPostMortem);

// Persistence & Feedback
router.post('/guide-seen', protect, nuroController.markGuideSeen);
router.post('/feedback', protect, nuroController.saveFeedback);

module.exports = router;
