const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    motive: {
        type: String,
        required: true
    },
    keywords: [{
        type: String
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contextGraph: {
        type: Object,
        default: {}
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
        enum: ['active', 'archived', 'completed'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
