const mongoose = require('mongoose');
const ActionWorkflow = require('./models/ActionWorkflow');

async function resetTasks() {
    try {
        await mongoose.connect('mongodb+srv://nurotra435_db_user:Mr9RsL5eIu12GjSm@nurotra-cluster.o3narnr.mongodb.net/?retryWrites=true&w=majority&appName=Nurotra-Cluster');
        const result = await ActionWorkflow.updateMany(
            { status: { $in: ['running', 'waiting', 'intervention', 'delayed', 'retrying'] } },
            { $set: { status: 'failed', activeMicroLog: 'Task reset. system restoration complete.' } }
        );
        console.log(`Reset ${result.modifiedCount} stuck tasks.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetTasks();
