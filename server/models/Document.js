const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: false // Can be a standalone document
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    keywords: [{
        type: String,
        trim: true
    }],
    type: {
        type: String,
        default: 'generic'
    },
    metadata: {
        purpose: String,
        category: String,
        entities: [String],
        confidenceScore: Number
    },
    content: {
        type: String,
        default: ''
    },
    url: {
        type: String, // Store physical/cloud URL of the document
        default: null
    },
    rawStructure: {
        type: Object, // Stores the original AI-generated JSON (sheets, sections, etc.)
        required: false
    },
    agentsEngaged: [{
        agentName: String,
        timestamp: { type: Date, default: Date.now },
        action: String
    }],
    trustScore: {
        type: Number,
        default: 0
    },
    revaluation: {
        interval: {
            type: String,
            enum: ['weekly', 'biweekly', 'monthly', 'quarterly', null],
            default: null
        },
        nextDueDate: {
            type: Date,
            default: null
        },
        lastRevaluedAt: {
            type: Date,
            default: null
        }
    },
    status: {
        type: String,
        enum: ['draft', 'final', 'executing'],
        default: 'draft'
    }
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
