require('dotenv').config();
const axios = require('axios');

async function testApi(version, model) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Respond 'OK'" }] }]
        }, { timeout: 10000 });

        return { success: true, version, model, data: response.data };
    } catch (error) {
        const status = error.response ? error.response.status : 'TIMEOUT/NETWORK';
        const message = error.response && error.response.data && error.response.data.error ? error.response.data.error.message : error.message;
        return { success: false, version, model, status, message };
    }
}

async function runHealthCheck() {
    const tests = [
        { v: 'v1beta', m: 'gemini-1.5-flash-latest' },
        { v: 'v1beta', m: 'gemini-pro' },
        { v: 'v1', m: 'gemini-1.5-flash' },
        { v: 'v1', m: 'gemini-1.5-pro' }
    ];

    console.log("🚀 Starting Gemini API Health Check...");
    let anySuccess = false;

    for (const t of tests) {
        const result = await testApi(t.v, t.m);
        if (result.success) {
            console.log(`✅ [${t.v}/${t.m}] ACTIVE`);
            anySuccess = true;
            break; // Stop if we find an active one
        } else {
            console.log(`❌ [${t.v}/${t.m}] FAILED (${result.status}) - ${result.message}`);
            if (result.status === 429) {
                console.error("💡 QUOTA EXCEEDED for this key/model.");
            }
        }
    }

    if (!anySuccess) {
        console.error("\n💀 ALL TESTS FAILED.");
        console.log("Check if your API key is correct and not restricted in Google Cloud Console.");
    }
}

runHealthCheck();
