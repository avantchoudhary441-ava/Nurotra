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
        expectationAlignment: { type: Number, default: 50 },
        compatibilityScore: { type: Number, default: 50 },
        experienceIndex: { type: Number, default: 50 },
        safetyComplianceScore: { type: Number, default: 50 }
    },
    // Deep history of every collaboration analyzed
    collabHistory: [{
        collabId: String, // Reference to a Match/Collab ID
        timestamp: { type: Date, default: Date.now },
        overallScore: Number, // The "Score Ring" value (0-100)

        // New History Fields
        collabType: { type: String, enum: ['Paid', 'Unpaid', 'Long-term', 'Short-term'], default: 'Short-term' },
        outcome: { type: String, enum: ['Success', 'Partial', 'Failed'], default: 'Success' },
        duration: String, // e.g., "2 weeks"
        satisfactionScore: {
            brand: { type: Number, default: 80 },
            influencer: { type: Number, default: 80 }
        },
        aiTag: { type: String, enum: ['Smooth', 'Delayed', 'Mismatch'], default: 'Smooth' },

        // Analysis Data
        positives: [String],
        negatives: [String],
        rootCause: String,
        fixes: [{
            text: String,
            actionType: String,
            target: String
        }],
        predictedSuccessProbability: Number,
        scoreDelta: Number
    }],
    // Behavioral Intelligence
    behavioralMetrics: {
        avgReplyTimeTrend: [{ date: Date, minutes: Number }], // Trend line data
        negotiationTime: { type: Number, default: 0 }, // minutes
        executionDelay: { type: Number, default: 0 }, // minutes from brief to delivery
        aiInsightNote: String
    },
    // Audience & Niche Intelligence
    audienceAlignment: {
        primaryFit: String,
        secondaryFit: String,
        avoidZone: [String],
        nicheStats: [{
            niche: String,
            successCount: { type: Number, default: 0 },
            failureCount: { type: Number, default: 0 }
        }]
    },
    // Milestones & Flags
    milestones: [{
        label: String,
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['achievement', 'fact', 'alert'], default: 'fact' }
    }],
    // Top-level patterns (Auto-generated)
    historicalPatterns: [String],
    // Read-only AI Memory reflections
    aiLearnings: [String],
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
