const axios = require('axios');
require('dotenv').config();

const testVoiceOptimization = async () => {
    const transcript = "Hey Nuro, make a marketing plan for our new AI product, keep it professional and add some charts as well";
    const userContext = { name: "Avant", role: "Digital Strategist", niche: "Marketing" };

    console.log("Testing Voice Structuring Optimization...");
    console.log("Transcript:", transcript);
    console.log("Context:", JSON.stringify(userContext));

    try {
        // We simulate the controller behavior by calling the service logic or the internal REST directly if easier.
        // Since I'm on the server, I can just require the service if I setup the environment.
        const aiService = require('./services/aiService');

        const result = await aiService.structureVoiceIntent(transcript, userContext);
        console.log("\n--- Structured Result ---");
        console.log(JSON.stringify(result, null, 2));

        if (result.structuredPrompt && !result.structuredPrompt.includes("Hey Nuro")) {
            console.log("\n✅ Success: Prompt cleaned of filler/greeting.");
        }
        if (result.docType === 'word' || result.topic.toLowerCase().includes('marketing')) {
            console.log("✅ Success: Context correctly identified.");
        }
    } catch (error) {
        console.error("❌ Test Failed:", error.message);
    }
};

testVoiceOptimization();
