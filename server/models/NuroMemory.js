const mongoose = require('mongoose');

const nuroMemorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // The AI's evolving understanding of the user
    behavioralPatterns: [{
        trait: String, // e.g., "Negotiation Anxiety", "Fast Responder"
        confidence: Number, // 0-100
        firstDetected: Date,
        lastDetected: Date
    }],
    // Moving averages for the "Comparison UI"
    metrics: {
        communicationClarity: { type: Number, default: 50 }, // 0-100
        reliabilityScore: { type: Number, default: 50 },
        trustIndex: { type: Number, default: 50 },
        expectationAlignment: { type: Number, default: 50 }
    },
    // Deep history of every collaboration analyzed
    collabHistory: [{
        collabId: String, // Reference to a Match/Collab ID
        timestamp: { type: Date, default: Date.now },
        overallScore: Number, // The "Score Ring" value (0-100)

        // Analysis Data
        positives: [String], // "What Went Right"
        negatives: [String], // "What Went Wrong"
        rootCause: String, // "Psychological reason"
        fixes: [String], // "Actionable Fixes"

        // Outcome Prediction for next time
        predictedSuccessProbability: Number, // %

        // Raw diff for comparison (e.g., +14%)
        scoreDelta: Number
    }],
    // Log of when Nuro stepped in
    interventionHistory: [{
        timestamp: { type: Date, default: Date.now },
        context: String, // "Chat", "Brief", "Offer"
        trigger: String, // "Tone degradation detected"
        adviceGiven: String,
        userAction: String // "Accepted", "Ignored"
    }]
}, { timestamps: true });

module.exports = mongoose.model('NuroMemory', nuroMemorySchema);
