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
    status: {
        type: String,
        enum: ['active', 'archived', 'completed'],
        default: 'active'
    },
    workspacePath: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
