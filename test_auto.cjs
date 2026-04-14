// Run with: node test_auto.cjs
const { parseActionIntent } = require('./server/services/actionAgentService');
const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

async function test() {
    try {
        console.log("--- TEST: INTENT PARSING ---");
        const command = "Register for the developer conference and fill my details";
        const result = await parseActionIntent(command);
        console.log("Parsed Result:", JSON.stringify(result, null, 2));
        
        const hasFormActions = result.workflow.actions.some(a => 
            a.label.toLowerCase().includes("form") || 
            a.label.toLowerCase().includes("detect")
        );
        
        if (hasFormActions) {
            console.log("SUCCESS: Form automation actions detected in pipeline.");
        } else {
            console.log("FAILURE: No form automation actions detected.");
        }

    } catch (e) {
        console.error("Test error:", e);
    } finally {
        process.exit(0);
    }
}

test();
