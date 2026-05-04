const actionAgentService = require("./server/services/actionAgentService");

async function test() {
    const command = "Tell me the current IPL score";
    console.log(`Testing command: ${command}`);
    try {
        const result = await actionAgentService.parseActionIntent(command);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
