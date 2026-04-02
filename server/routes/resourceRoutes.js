const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const { syncResources } = require('../scripts/syncResources');
const passport = require('passport');

// Auth Middleware
const auth = passport.authenticate('jwt', { session: false });

/**
 * @route   GET /api/resources
 * @desc    Get all resources for the current user
 */
router.get('/', auth, async (req, res) => {
    try {
        const resources = await Resource.find({ userId: req.user._id }).sort({ lastMentioned: -1 });
        res.json(resources);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/resources/sync
 * @desc    One-time sync to populate registry from Docs & Contacts
 */
router.post('/sync', auth, async (req, res) => {
    try {
        const result = await syncResources(req.user._id);
        res.json({ message: 'Sync complete', ...result });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/resources/query
 * @desc    Test grounding logic
 */
router.post('/query', auth, async (req, res) => {
    const { prompt } = req.body;
    const resourceEngineService = require('../services/resourceEngineService');
    try {
        const grounded = await resourceEngineService.autoGround(req.user._id, prompt);
        res.json(grounded);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
