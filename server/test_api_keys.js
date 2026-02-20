const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const testGemini = async (key) => {
    if (!key) return { status: 'Missing', error: null };
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "ping" }] }]
        });
        return { status: 'Working', detail: 'Response received' };
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        const code = error.response?.status;
        if (code === 400 && msg.includes('not found')) {
            // Try v1
            try {
                const urlV1 = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${key}`;
                await axios.post(urlV1, { contents: [{ parts: [{ text: "ping" }] }] });
                return { status: 'Working', detail: 'Response received (v1)' };
            } catch (v1Error) {
                return { status: 'Failed', detail: v1Error.response?.data?.error?.message || v1Error.message };
            }
        }
        if (code === 429 || msg.toLowerCase().includes('quota')) return { status: 'Quota Exceeded', detail: msg };
        return { status: 'Failed', detail: msg };
    }
};

const testOpenAI = async (key) => {
    if (!key) return { status: 'Missing', error: null };
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5
        }, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        return { status: 'Working', detail: 'Response received' };
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        const code = error.response?.status;
        if (code === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('billing')) return { status: 'Quota/Billing Issue', detail: msg };
        return { status: 'Failed', detail: msg };
    }
};

const testXAI = async (key) => {
    if (!key) return { status: 'Missing', error: null };
    try {
        const response = await axios.post('https://api.x.ai/v1/chat/completions', {
            model: "grok-beta",
            messages: [{ role: "user", content: "ping" }]
        }, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        return { status: 'Working', detail: 'Response received' };
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        return { status: 'Failed', detail: msg };
    }
};

const testAnthropic = async (key) => {
    if (!key) return { status: 'Missing', error: null };
    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: "claude-3-haiku-20240307",
            max_tokens: 5,
            messages: [{ role: "user", content: "ping" }]
        }, {
            headers: {
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });
        return { status: 'Working', detail: 'Response received' };
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('quota')) return { status: 'Quota Issue', detail: msg };
        return { status: 'Failed', detail: msg };
    }
};

const main = async () => {
    console.log('--- API KEY DIAGNOSTICS ---');

    const results = {
        Gemini: await testGemini(process.env.GEMINI_API_KEY),
        OpenAI: await testOpenAI(process.env.OPENAI_API_KEY),
        xAI: await testXAI(process.env.XAI_API_KEY),
        Anthropic: await testAnthropic(process.env.ANTHROPIC_API_KEY)
    };

    const fs = require('fs');
    fs.writeFileSync('api_test_results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to api_test_results.json');
};

main();
