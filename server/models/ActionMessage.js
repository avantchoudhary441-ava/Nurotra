const mongoose = require("mongoose");

const ActionMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ["user", "agent", "system"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["text", "workflow_preview", "browser_result", "execution_timeline", "result", "milestone", "clarification"],
        default: "text"
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ActionWorkflow"
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("ActionMessage", ActionMessageSchema);
