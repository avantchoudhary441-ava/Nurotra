require('dotenv').config();
const { processDocsAgentQuery } = require('./services/aiService');
const mongoose = require('mongoose');

async function testHistory() {
    console.log("Starting History Context Test...");

    // Simulate the first message providing data/context
    const history = [
        {
            role: 'user',
            content: `Business & Sales Analytics 
            Which products generate high revenue but low profit margins? 
            Which cities show high demand but low sales penetration? 
            Which customers contribute to 80% of total revenue? 
            Which product categories are losing sales month over month? 
            Which sales channel (online/store/partner) performs best in each region?`
        },
        {
            role: 'assistant',
            content: 'I understand you want to analyze Business & Sales metrics. What type of document should I create?'
        }
    ];

    const prompt = "Create a dashboard of the given data";

    const result = await processDocsAgentQuery(prompt, {}, history, { intent: 'CREATE', metadata: { docType: 'dashboard' } });

    console.log("--- TEST RESULT ---");
    console.log("Title:", result.generation.data.title);
    console.log("FileName:", result.generation.data.fileName);
    console.log("Widgets Count:", result.generation.data.widgets.length);

    const widgetTitles = result.generation.data.widgets.map(w => w.title).join(", ");
    console.log("Widget Titles:", widgetTitles);

    // Assertions (logically)
    const isGeneric = result.generation.data.title.includes("Company Performance");
    if (isGeneric) {
        console.error("FAIL: Dashboard title is still generic!");
    } else {
        console.log("SUCCESS: Dashboard title seems specific!");
    }

    const mentionsRevenue = widgetTitles.toLowerCase().includes("revenue") || widgetTitles.toLowerCase().includes("profit");
    if (!mentionsRevenue) {
        console.error("FAIL: Dashboard doesn't seem to mention revenue/profit from history!");
    } else {
        console.log("SUCCESS: Dashboard mentions historical context!");
    }

    process.exit(0);
}

testHistory().catch(err => {
    console.error("Test Error:", err);
    process.exit(1);
});
