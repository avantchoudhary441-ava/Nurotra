const mongoose = require("mongoose");

const LogStepSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    label: { type: String, required: true },
    status: { 
        type: String, 
        enum: ["pending", "in_progress", "completed", "failed", "retrying", "skipped"],
        default: "completed" 
    },
    message: { type: String },
    retryCount: { type: Number, default: 0 },
    methodSwitched: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} } // For links, file routes, traces
});

const SystemExecutionLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    workflowId: { 
        type: String, 
        index: true,
        description: "Links related actions together in an execution chain" 
    },
    chainId: { 
        type: String, 
        index: true,
        description: "Higher-level identifier grouping multi-agent workflows" 
    },
    state: {
        type: String,
        enum: ["Pending", "In Progress", "Completed", "Failed", "Retrying"],
        default: "Pending",
        index: true
    },
    priority: {
        type: String,
        enum: ["High", "Medium", "Low"],
        default: "Medium"
    },
    agentType: {
        type: String,
        enum: ["DocsAgent", "ActionAgent", "TimeAgent", "CommAgent", "Orchestrator", "System"],
        required: true
    },
    triggerSource: {
        type: String,
        description: "What initiated this step: User command, webhook, event rule, etc."
    },
    systemLog: {
        type: String,
        description: "Raw technical description"
    },
    userNarrative: {
        type: String,
        description: "Clean, abstracted summary for the user"
    },
    confidenceScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    steps: [LogStepSchema],
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    searchTokens: [{ type: String, index: true }],
    archiveLevel: {
        type: String,
        enum: ["detailed", "summarized", "pattern_only"],
        default: "detailed"
    }
});

// Auto-update lastUpdated timestamp on save
SystemExecutionLogSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    // Build search tokens automatically if they are empty
    if (this.isModified('userNarrative') || this.isModified('systemLog')) {
        const textToTokenize = `${this.userNarrative || ''} ${this.systemLog || ''} ${this.agentType}`;
        const words = textToTokenize.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 2);
        this.searchTokens = [...new Set(words)]; // Unique tokens
    }
    next();
});

module.exports = mongoose.model("SystemExecutionLog", SystemExecutionLogSchema);
