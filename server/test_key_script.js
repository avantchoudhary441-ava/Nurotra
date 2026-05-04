require("dotenv").config();
const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
console.log("Checking key:", apiKey ? apiKey.substring(0, 10) + "..." + apiKey.substring(apiKey.length - 4) : "MISSING");

const openai = new OpenAI({ apiKey: apiKey });

async function testKey() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for a faster, cheaper test
      messages: [{ role: "user", content: "Say hello!" }],
      max_tokens: 5
    });
    console.log("SUCCESS! The key is working. Response:", response.choices[0].message.content);
  } catch (error) {
    console.error("ERROR: The key failed to authenticate.");
    console.error("Status:", error.status);
    console.error("Message:", error.message);
  }
}

testKey();
