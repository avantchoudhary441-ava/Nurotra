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
    agentsEngaged: [{
        agentName: String,
        timestamp: { type: Date, default: Date.now },
        action: String
    }],
    trustScore: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['draft', 'final', 'executing'],
        default: 'draft'
    }
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
