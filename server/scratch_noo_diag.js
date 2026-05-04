require('dotenv').config();
const orchestratorService = require('./services/orchestratorService');
const intentEngine = require('./services/intentEngine');

async function runDiagnostic() {
    console.log("=== NUROTRA ORCHESTRA BASELINE DIAGNOSTIC ===");
    
    const testPrompt = "Research Nvidia's latest Q1 earnings and draft a summary for my manager.";
    
    // Step 1: Breakdown
    console.log("\n[1] Testing Breakdown Logic...");
    const intent = intentEngine.classifyIntent(testPrompt);
    const tasks = await orchestratorService.breakDownTask(testPrompt, { ...intent, docType: 'word' });
    
    console.log(`Steps generated: ${tasks.length}`);
    tasks.forEach(t => console.log(` - Step ${t.step}: [${t.suggested_agent}] ${t.action}`));

    // Step 2: Context Handoff Check
    console.log("\n[2] Checking Data Handoff Markers...");
    const handoffMarkers = tasks.filter(t => t.description.toLowerCase().includes("step 1") || (t.handoff_data && Object.keys(t.handoff_data).length > 0));
    
    if (handoffMarkers.length > 0) {
        console.log("✅ Handoff markers found in breakdown.");
    } else {
        console.log("❌ WARNING: No explicit handoff markers found in breakdown. Agents might start blind.");
    }

    // Step 3: Mock Execution Flow
    console.log("\n[3] Simulating Cumulative Context...");
    const sharedContext = {
        outputs: {
            step_1: { success: true, data: "Nvidia Q1 Revenue: $26B, beat expectations." }
        }
    };

    console.log("Shared Context defined with Step 1 results.");
    
    // We will check if the next task description can effectively use this.
    const step2Task = tasks.find(t => t.step === 2);
    if (step2Task) {
        console.log(`Step 2 Target: ${step2Task.description}`);
    }

    console.log("\n=== DIAGNOSTIC COMPLETE ===");
}

runDiagnostic().catch(console.error);
