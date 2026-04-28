const mongoose = require('mongoose');
const ActionWorkflow = require('./models/ActionWorkflow');
const ActionMessage = require('./models/ActionMessage');

async function debug() {
    await mongoose.connect('mongodb://localhost:27017/nurotra');
    console.log("Connected to DB");

    const lastWorkflows = await ActionWorkflow.find().sort({ startTime: -1 }).limit(3);
    console.log("Last 3 Workflows:");
    lastWorkflows.forEach(w => {
        console.log(`- ID: ${w._id}, Title: ${w.title}, Status: ${w.status}, ActiveLog: ${w.activeMicroLog}`);
    });

    const lastMessages = await ActionMessage.find().sort({ timestamp: -1 }).limit(5);
    console.log("\nLast 5 Messages:");
    lastMessages.forEach(m => {
        console.log(`- Role: ${m.role}, Content: ${m.content.substring(0, 50)}, Type: ${m.type}`);
    });

    process.exit(0);
}

debug().catch(err => {
    console.error(err);
    process.exit(1);
});
