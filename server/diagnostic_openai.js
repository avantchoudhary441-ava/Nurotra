require('dotenv').config();
const { OpenAI } = require("openai");

async function testOpenAI() {
    console.log("Checking OpenAI API Status...");

    if (!process.env.OPENAI_API_KEY) {
        console.error("❌ ERROR: OPENAI_API_KEY is missing from .env");
        process.exit(1);
    }

    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        console.log("Attempting a lightweight completion...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Say 'OpenAI Connection Status: ACTIVE'" }],
            max_tokens: 10
        });

        const content = response.choices[0].message.content.trim();
        console.log(`\n✅ SUCCESS: ${content}`);
        console.log(`Model used: ${response.model}`);
    } catch (e) {
        console.error("\n❌ OpenAI API Test Failed:");
        if (e.status === 401) {
            console.error("   Invalid API Key. Please check the key in .env.");
        } else if (e.status === 429) {
            console.error("   Quota exceeded or rate limited.");
        } else {
            console.error(`   Error message: ${e.message}`);
        }
    }
}

testOpenAI();
