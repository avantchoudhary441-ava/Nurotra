require('dotenv').config({ path: 'server/.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

async function testKeys() {
    console.log("--- Testing OpenAI Key ---");
    if (process.env.OPENAI_API_KEY) {
        try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: "hello" }],
                max_tokens: 5
            });
            console.log("OpenAI Success:", response.choices[0].message.content);
        } catch (e) {
            console.error("OpenAI Failed:", e.message);
        }
    } else {
        console.log("OpenAI Key MISSING");
    }

    console.log("\n--- Testing Gemini Keys ---");
    const keys = [];
    if (process.env.GEMINI_API_KEY) keys.push({ name: 'GEMINI_API_KEY', val: process.env.GEMINI_API_KEY });
    Object.keys(process.env).forEach(k => {
        if (k.startsWith('GEMINI_API_KEY_')) keys.push({ name: k, val: process.env[k] });
    });

    for (const key of keys) {
        console.log(`Testing ${key.name}: ${key.val.substring(0, 10)}...`);
        try {
            const genAI = new GoogleGenerativeAI(key.val);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("hello");
            console.log(`${key.name} Success:`, result.response.text());
        } catch (e) {
            console.error(`${key.name} Failed:`, e.message);
        }
    }
}

testKeys();
