const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testOpenAI() {
    console.log('--- Starting OpenAI Test ---');
    try {
        console.log('Using Key:', process.env.OPENAI_API_KEY ? 'Present (Ending in ' + process.env.OPENAI_API_KEY.slice(-4) + ')' : 'Missing');

        // We test a simple list models or a cheap generation to check status
        // But since we use it for DALL-E, let's just check if we can list models first as a connectivity/auth check
        const models = await openai.models.list();
        console.log('SUCCESS: Authenticated successfully.');
        console.log('Available Models Count:', models.data.length);

        // Check if dall-e-3 is in the list
        const hasDalle = models.data.some(m => m.id === 'dall-e-3');
        console.log('DALL-E 3 Available:', hasDalle);

    } catch (err) {
        console.error('API ERROR:', err.message);
        if (err.status === 401) console.error('Reason: Invalid API Key');
        if (err.status === 429) console.error('Reason: Quota Exceeded');
    }
}

testOpenAI();
