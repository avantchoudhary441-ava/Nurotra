const mongoose = require('mongoose');
require('dotenv').config();
const ActionWorkflow = require('./models/ActionWorkflow');

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("Connected to MongoDB. Clearing active tasks...");
        const result = await ActionWorkflow.updateMany(
            { status: { $in: ["running", "waiting", "retrying", "intervention", "delayed"] } },
            { $set: { status: "stopped" } }
        );
        console.log(`Updated ${result.modifiedCount} tasks to 'stopped'.`);
        process.exit(0);
    })
    .catch(err => {
        console.error("Error connecting to DB:", err);
        process.exit(1);
    });
