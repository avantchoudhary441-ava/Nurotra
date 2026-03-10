const mongoose = require('mongoose');

const WorkspaceFileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
        index: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: false
    },
    fileName: {
        type: String,
        required: true,
        trim: true
    },
    fileType: {
        type: String,
        enum: ['docx', 'xlsx', 'pptx', 'pdf'],
        required: true
    },
    fileData: {
        type: Buffer,
        required: true
    },
    size: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Compound index: one file per document per user
WorkspaceFileSchema.index({ userId: 1, documentId: 1 }, { unique: true });

module.exports = mongoose.model('WorkspaceFile', WorkspaceFileSchema);
