const axios = require('axios');
require('dotenv').config({ path: '../server/.env' });

async function testGemini() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Using Key:", key ? key.substring(0, 5) + "..." : "MISSING");

    if (!key) return;

    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];

    for (const model of models) {
        try {
            console.log(`Testing model: ${model}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: "Hi" }] }]
            });
            console.log(`Success with ${model}:`, response.status);
        } catch (error) {
            console.error(`Error with ${model}:`, error.response?.data?.error?.message || error.message);
        }
    }
}

testGemini();
