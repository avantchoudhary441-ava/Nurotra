const WorkspaceFile = require('../models/WorkspaceFile');
const cloudExportService = require('../services/cloudExportService');

/**
 * Save (or update) a generated file to the cloud workspace in MongoDB.
 * Called internally by docsAgentController — not a direct route.
 */
const saveToCloud = async (docData, userId, documentId, projectId, formatOverride) => {
    try {
        const { buffer, ext, mimeType, fileName } = await cloudExportService.generateBuffer(docData, formatOverride);
        const fileType = ext.replace('.', ''); // 'docx', 'xlsx', 'pptx'

        await WorkspaceFile.findOneAndUpdate(
            { userId, documentId },
            {
                userId,
                documentId,
                projectId: projectId || null,
                fileName,
                fileType,
                fileData: buffer,
                size: buffer.length
            },
            { upsert: true, new: true }
        );

        return { success: true, fileName };
    } catch (err) {
        console.error('[WorkspaceController] saveToCloud error:', err);
        throw err;
    }
};

/**
 * Stream a file to the browser as a download.
 * Route: GET /api/workspace/download/:docId
 * :docId = the Document _id (not WorkspaceFile _id)
 * If no WorkspaceFile exists yet (pre-migration docs), generates on-the-fly.
 */
const downloadFile = async (req, res) => {
    try {
        const { docId } = req.params;

        const mimeMap = {
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'pdf': 'application/pdf'
        };

        // Try to find existing cloud file
        let wsFile = await WorkspaceFile.findOne({ documentId: docId, userId: req.user._id });

        if (!wsFile) {
            // Not yet saved to cloud — generate on-the-fly from Document model
            const Document = require('../models/Document');
            const doc = await Document.findOne({ _id: docId, userId: req.user._id });

            if (!doc) {
                return res.status(404).json({ message: 'Document not found.' });
            }

            // Determine format from doc type
            const formatMap = { excel: 'xlsx', ppt: 'pptx', word: 'docx' };
            const format = formatMap[doc.type] || 'docx';

            const { buffer, ext, mimeType, fileName } = await cloudExportService.generateBuffer(
                { name: doc.name, type: doc.type, content: doc.content, rawStructure: doc.rawStructure },
                format
            );
            const fileType = ext.replace('.', '');

            // Save for next time
            wsFile = await WorkspaceFile.findOneAndUpdate(
                { userId: req.user._id, documentId: docId },
                {
                    userId: req.user._id,
                    documentId: docId,
                    projectId: doc.projectId || null,
                    fileName,
                    fileType,
                    fileData: buffer,
                    size: buffer.length
                },
                { upsert: true, new: true }
            );
        }

        const mimeType = mimeMap[wsFile.fileType] || 'application/octet-stream';
        res.setHeader('Content-Disposition', `attachment; filename="${wsFile.fileName}"`);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', wsFile.size);
        res.send(wsFile.fileData);
    } catch (err) {
        console.error('[WorkspaceController] downloadFile error:', err);
        res.status(500).json({ message: 'Failed to download file', error: err.message });
    }
};


/**
 * List all workspace files for the current user.
 * Route: GET /api/workspace/list
 */
const listWorkspace = async (req, res) => {
    try {
        const files = await WorkspaceFile.find({ userId: req.user._id })
            .select('-fileData') // Don't send binary data in the listing
            .sort({ updatedAt: -1 });

        res.json(files.map(f => ({
            id: f._id,
            documentId: f.documentId,
            projectId: f.projectId,
            fileName: f.fileName,
            fileType: f.fileType,
            size: f.size,
            updatedAt: f.updatedAt
        })));
    } catch (err) {
        console.error('[WorkspaceController] listWorkspace error:', err);
        res.status(500).json({ message: 'Failed to list workspace files' });
    }
};

/**
 * Delete a workspace file.
 * Route: DELETE /api/workspace/:docId
 */
const deleteFile = async (req, res) => {
    try {
        const { docId } = req.params;
        await WorkspaceFile.findOneAndDelete({ documentId: docId, userId: req.user._id });
        res.json({ message: 'File removed from cloud workspace' });
    } catch (err) {
        console.error('[WorkspaceController] deleteFile error:', err);
        res.status(500).json({ message: 'Failed to delete workspace file' });
    }
};

module.exports = { saveToCloud, downloadFile, listWorkspace, deleteFile };
