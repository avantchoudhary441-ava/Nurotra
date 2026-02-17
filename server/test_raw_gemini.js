require('dotenv').config({ path: './.env' });
const axios = require('axios');

async function testRawGemini() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Listing Models for Key:", key ? key.substring(0, 10) + "..." : "MISSING");

    try {
        const urlList = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const listRes = await axios.get(urlList);
        const models = listRes.data.models;
        const firstModel = models.find(m => m.supportedGenerationMethods.includes('generateContent'));

        if (!firstModel) {
            console.error("No compatible models found!");
            return;
        }

        console.log("Testing Model:", firstModel.name);
        const urlGen = `https://generativelanguage.googleapis.com/v1beta/${firstModel.name}:generateContent?key=${key}`;
        const genRes = await axios.post(urlGen, {
            contents: [{ parts: [{ text: "hello" }] }]
        });
        console.log("Success! Response:", JSON.stringify(genRes.data, null, 2));
    } catch (e) {
        console.error("FAILED!");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

testRawGemini();
