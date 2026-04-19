const mongoose = require("mongoose");

const ActionStepSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    label: { type: String, required: true },
    icon: { type: String, default: "default" },
    status: { 
        type: String, 
        enum: ["pending", "running", "completed", "failed", "intervention", "delayed", "retrying", "paused", "stopped"],
        default: "pending" 
    },
    microLogs: [{ type: String }],
    requiresIntervention: { type: Boolean, default: false },
    interventionMsg: { type: String },
    isBulk: { type: Boolean, default: false },
    totalItems: { type: Number, default: 0 },
    bulkProgress: { type: Number, default: 0 },
    isWait: { type: Boolean, default: false },
    // --- NEW: Delay & Retry ---
    delayMs: { type: Number, default: 0 },
    delayUntil: { type: Date },
    retryConfig: {
        maxRetries: { type: Number, default: 0 },
        retryCount: { type: Number, default: 0 },
        retryDelayMs: { type: Number, default: 2000 }
    },
    // --- Action Parameters (e.g., search query, email recipient) ---
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    // --- NEW: Autonomous Execution ---
    isReversible: { type: Boolean, default: true },
    missingData: [{
        field: String,
        criticality: { type: String, enum: ["critical", "minor"], default: "minor" },
        inferredValue: mongoose.Schema.Types.Mixed
    }],
    resultData: { type: mongoose.Schema.Types.Mixed }
});

const ExecutionLogSchema = new mongoose.Schema({
    stepId: { type: Number },
    stepLabel: { type: String },
    status: { type: String },
    message: { type: String },
    evidenceUrl: { type: String }, // Link to proof screenshot
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ["info", "warn", "error", "success"], default: "info" }
});

const ConditionSchema = new mongoose.Schema({
    field: { type: String },
    operator: { type: String }, // Relaxed from enum for AI compatibility
    value: { type: mongoose.Schema.Types.Mixed },
    raw_text: { type: String }
});

const ActionWorkflowSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    title: { type: String, required: true },
    type: { type: String, enum: ["active", "scheduled", "event_driven"], default: "active" },
    status: { 
        type: String, 
        enum: ["waiting", "running", "completed", "failed", "intervention", "delayed", "retrying", "paused", "stopped"],
        default: "running"
    },
    scheduledTime: { type: String },
    resources: [{
        name: { type: String },
        source: { type: String }
    }],
    steps: [ActionStepSchema],
    // --- NEW: Dynamic Execution Logic ---
    executionMode: { type: String, enum: ["background", "intervention"], default: "background" },
    deadline: { type: Date },
    autoAcceptAt: { type: Date },
    confirmationStatus: { 
        type: String, 
        enum: ["none", "pending", "confirmed", "auto-confirmed", "rejected"], 
        default: "none" 
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    activeMicroLog: { type: String, default: "Initializing..." },
    intentData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // --- NEW: Event-Driven Fields ---
    isEventDriven: { type: Boolean, default: false },
    eventRuleId: { type: mongoose.Schema.Types.ObjectId, ref: "EventRule" },
    triggerConfig: {
        type: { type: String, enum: ["manual", "webhook", "message_received", "system_state", "scheduled"] },
        source: { type: String },
        webhookId: { type: String }
    },
    conditions: [ConditionSchema],
    conditionLogic: { type: String, enum: ["AND", "OR"], default: "AND" },
    conditionRawText: { type: String },
    // --- NEW: Execution Logs ---
    executionLogs: [ExecutionLogSchema],
    // --- NEW: Retry metadata ---
    totalRetries: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    // --- NEW: UI State ---
    isAcknowledged: { type: Boolean, default: false }
});

module.exports = mongoose.model("ActionWorkflow", ActionWorkflowSchema);
