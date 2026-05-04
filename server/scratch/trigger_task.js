const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    const ActionWorkflow = require('./models/ActionWorkflow');
    
    // Find a user (likely the one from the session)
    const user = await User.findOne().sort({ lastActive: -1 });
    if (!user) {
        console.log("No user found");
        process.exit(1);
    }
    
    console.log(`Using User: ${user.email} (${user._id})`);
    
    // Trigger the command via local fetch
    const response = await fetch('http://localhost:5000/api/action-agent/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + 'MOCK_TOKEN' // The controller uses DEV_USER_ID if no token
        },
        body: JSON.stringify({
            command: "Job Search & Application: Software Engineer",
            userId: user._id
        })
    });
    
    const data = await response.json();
    console.log("Execution Result:", data);
    process.exit(0);
}

run();
