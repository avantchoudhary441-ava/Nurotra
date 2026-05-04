const axios = require('axios');
require('dotenv').config();

async function listModels(key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    try {
        const response = await axios.get(url);
        console.log('--- Available Models ---');
        console.table(response.data.models.map(m => ({
            name: m.name,
            version: m.version,
            display: m.displayName,
            methods: (m.supportedGenerationMethods || []).join(', ')
        })).filter(m => m.methods.includes('generateContent')));
    } catch (err) {
        console.error('Failed to list models:', err.response?.data?.error?.message || err.message);
    }
}

const key = process.env.GEMINI_API_KEY;
if (key) {
    console.log(`Checking key ending in: ${key.slice(-4)}`);
    listModels(key);
} else {
    console.error("No GEMINI_API_KEY found.");
}
