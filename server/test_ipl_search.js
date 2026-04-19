
const mongoose = require('mongoose');
const actionAgentService = require('./services/actionAgentService');
const actionExecutionService = require('./services/actionExecutionService');
const ActionWorkflow = require('./models/ActionWorkflow');
require('dotenv').config();

async function testIPLSearch() {
    console.log("🚀 Testing IPL Search Extraction...");
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ DB Connected");

        const command = "tell me todays ipl score";
        const parsedData = await actionAgentService.parseActionIntent(command);
        console.log("Intent Parsed:", JSON.stringify(parsedData, null, 2));

        if (parsedData.intent === "WORKFLOW_EXECUTION") {
            const workflow = parsedData.workflow;
            const userId = new mongoose.Types.ObjectId("000000000000000000000001"); // Dev User

            // Simulate the web_search step specifically
            const searchStep = workflow.actions.find(a => a.label.toLowerCase().includes('search'));
            if (searchStep) {
                console.log("🔍 Executing Search Step:", searchStep.label);
                const context = { userId, actionDef: searchStep };
                const result = await actionExecutionService["web_search"](searchStep, context);
                console.log("\n\n🏆 FINAL IPL RESULT:\n", result.data?.answer || result.message);
            }
        }
    } catch (err) {
        console.error("❌ Test Failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

testIPLSearch();
