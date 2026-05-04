require('dotenv').config();
const aiService = require('./services/aiService');

async function testDashboards() {
    const prompts = [
        {
            name: "Finance Prompt",
            prompt: "Financial & Business Health: Which business units are profitable but declining in growth? Which expenses are increasing faster than revenue? Which months historically show financial risk?"
        },
        {
            name: "Logistics Prompt",
            prompt: "Supply Chain & Logistics: Which suppliers frequently cause delivery delays? Which products face repeated stockouts across warehouses? Which routes increase transportation cost the most?"
        },
        {
            name: "Explicit Chart Request",
            prompt: "Create a dashboard for marketing performance. Use a PIE CHART for channel distribution and a LINE CHART for monthly lead growth."
        }
    ];

    console.log("--- DYNAMIC DASHBOARD INTELLIGENCE TEST ---");

    for (const test of prompts) {
        console.log(`\n>>> TESTING: ${test.name}`);
        console.log(`PROMPT: "${test.prompt}"`);

        try {
            // Mock preParsed to simulate dashboard intent
            const preParsed = {
                intent: "CREATE",
                metadata: { category: "General", docType: "dashboard" }
            };

            // We need to bypass the docType detection in aiService if we want to force dashboard path
            // or just ensure the prompt triggers it. 
            // The prompt "Create a dashboard for..." should trigger it via intentEngine.

            const response = await aiService.processDocsAgentQuery(test.prompt, { name: "Test User", niche: "General" }, [], preParsed);

            if (response.generation && response.generation.type === 'dashboard') {
                const data = response.generation.data;
                console.log(`SUCCESS: Dashboard generated.`);
                console.log(`TITLE: ${data.title}`);
                console.log(`FILENAME: ${data.fileName}`);
                console.log(`WIDGET COUNT: ${data.widgets.length}`);

                data.widgets.forEach((w, idx) => {
                    console.log(`  Widget ${idx + 1}: [${w.type.toUpperCase()}] ${w.title} ${w.chartType ? `(Chart: ${w.chartType})` : ''}`);
                });
            } else {
                console.log(`FAILED: Expected dashboard type, but got ${response.generation?.type}`);
                if (response.text) console.log(`REPLY: ${response.text.substring(0, 100)}...`);
            }
        } catch (err) {
            console.error(`ERROR in test ${test.name}:`, err.message);
        }
    }
}

testDashboards().catch(err => console.error(err));
