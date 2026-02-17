require('dotenv').config({ path: './.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Testing Gemini with Key:", key ? key.substring(0, 10) + "..." : "MISSING");

    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("hello");
        console.log("Success! Response:", result.response.text());
    } catch (e) {
        console.error("FAILED!");
        console.error(e);
    }
}

testGemini();
