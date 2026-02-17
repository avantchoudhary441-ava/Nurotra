require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
const Anthropic = require("@anthropic-ai/sdk");

async function testProviders() {
    console.log("Starting AI Provider Diagnostics...");

    // 1. Test Gemini
    console.log("\n--- Testing Gemini ---");
    if (!process.env.GEMINI_API_KEY) {
        console.log("GEMINI_API_KEY missing");
    } else {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Say hello");
            console.log("Gemini Success:", result.response.text());
        } catch (e) {
            console.log("Gemini Failed:", e.message);
        }
    }

    // 2. Test OpenAI
    console.log("\n--- Testing OpenAI ---");
    if (!process.env.OPENAI_API_KEY) {
        console.log("OPENAI_API_KEY missing");
    } else {
        try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: "Say hello" }]
            });
            console.log("OpenAI Success:", response.choices[0].message.content);
        } catch (e) {
            console.log("OpenAI Failed:", e.message);
        }
    }

    // 3. Test Anthropic
    console.log("\n--- Testing Anthropic ---");
    if (!process.env.ANTHROPIC_API_KEY) {
        console.log("ANTHROPIC_API_KEY missing");
    } else {
        try {
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const response = await anthropic.messages.create({
                model: "claude-3-haiku-20240307",
                max_tokens: 10,
                messages: [{ role: "user", content: "Say hello" }]
            });
            console.log("Anthropic Success:", response.content[0].text);
        } catch (e) {
            console.log("Anthropic Failed:", e.message);
        }
    }

    console.log("\nDiagnostics Complete.");
}

testProviders();
