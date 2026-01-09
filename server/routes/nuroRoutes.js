const express = require('express');
const router = express.Router();
const nuroController = require('../controllers/nuroController');
const { protect } = require('../middleware/authMiddleware');

router.get('/memory', protect, nuroController.getNuroMemory);
router.get('/memory/:userId', protect, nuroController.getPublicNuroMemory);
router.post('/analyze', protect, nuroController.runPostMortem);

module.exports = router;
