const axios = require('axios');
require('dotenv').config();

async function testKeyModels(keyObj) {
    const models = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
    const results = [];

    for (const modelName of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${keyObj.value}`;
        try {
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: "hi" }] }]
            }, { timeout: 10000 });
            results.push({ model: modelName, status: "✅ Active", reason: "Success" });
        } catch (err) {
            const errorData = err.response?.data?.error || {};
            const msg = errorData.message || err.message;
            let status = "❌ Failed";
            if (msg.includes("quota") || msg.includes("limit") || err.response?.status === 429) {
                status = "⚠️ Quota Exceeded";
            } else if (err.response?.status === 401) {
                status = "🚫 Invalid Key";
            } else if (msg.includes("not found")) {
                status = "❓ Model Not Found";
            }
            results.push({ model: modelName, status, reason: msg.substring(0, 150) });
        }
    }
    return results;
}

async function runDetailedCheck() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("GEMINI_API_KEY missing in .env");
        return;
    }

    console.log(`--- Detailed Gemini Key Check (Key ending in: ${key.slice(-4)}) ---`);
    const results = await testKeyModels({ value: key });
    console.table(results);
}

runDetailedCheck();
