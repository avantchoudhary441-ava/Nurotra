const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');

router.get('/', async (req, res) => {
    const status = {
        openai: { status: 'unknown', details: null },
        unsplash: { status: 'unknown', details: null },
        server: 'online',
        timestamp: new Date().toISOString()
    };

    // 1. Check OpenAI
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 5000 });
        if (!process.env.OPENAI_API_KEY) throw new Error("API Key missing");
        
        await openai.models.list();
        status.openai.status = 'connected';
    } catch (err) {
        status.openai.status = 'error';
        status.openai.details = err.message;
    }

    // 2. Check Unsplash
    try {
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        if (!accessKey) throw new Error("Unsplash access key missing");
        
        const response = await axios.get("https://api.unsplash.com/photos/random", {
            headers: { Authorization: `Client-ID ${accessKey}` },
            timeout: 5000
        });
        status.unsplash.status = response.status === 200 ? 'connected' : 'error';
    } catch (err) {
        status.unsplash.status = 'error';
        status.unsplash.details = err.message;
    }

    // 3. Check MongoDB
    try {
        const mongoose = require('mongoose');
        status.mongodb = {
            status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            readyState: mongoose.connection.readyState
        };
    } catch (err) {
        status.mongodb = { status: 'error', details: err.message };
    }

    const overallError = status.openai.status === 'error' || status.mongodb?.status === 'disconnected';
    res.status(overallError ? 503 : 200).json(status);
});

module.exports = router;
