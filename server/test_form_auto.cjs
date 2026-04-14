const { parseActionIntent } = require('./server/services/actionAgentService');
const { executeStep } = require('./server/services/actionExecutionService');
const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

async function test() {
    try {
        console.log("--- TEST 1: INTENT PARSING ---");
        const command = "Apply for the Google Software Internship";
        const intent = await parseActionIntent(command);
        console.log("Parsed Intent:", JSON.stringify(intent, null, 2));

        if (intent.intent === 'WORKFLOW_EXECUTION') {
            const workflow = intent.workflow;
            console.log(`\n--- TEST 2: EXECUTION MOCK (Step 1: ${workflow.actions[0].label}) ---`);
            
            // Mock context
            const context = {
                userId: "6606f23f03b22a07c30e9d6d", // A mock user ID (needs to exist if running live)
                workflowTitle: workflow.title,
                environment: { description: "Google Careers Page" }
            };

            // Execute first step
            const result = await executeStep(workflow.actions[0], context);
            console.log("Execution Result:", JSON.stringify(result, null, 2));
        }

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        process.exit(0);
    }
}

test();
