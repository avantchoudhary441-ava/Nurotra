require('dotenv').config({ path: 'server/.env' });
const OpenAI = require("openai");

async function testGPT4o() {
    if (!process.env.OPENAI_API_KEY) {
        console.log("OpenAI Key MISSING");
        return;
    }
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5
        });
        console.log("GPT-4o Success:", response.choices[0].message.content);
    } catch (e) {
        console.error("GPT-4o Failed:", e.message);
    }
}

testGPT4o();
