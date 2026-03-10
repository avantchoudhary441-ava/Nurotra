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
        const { format } = req.query; // New: optional format override (pdf, docx, etc)

        const mimeMap = {
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'pdf': 'application/pdf'
        };

        // If a specific format is requested, we often need to generate it on-the-fly
        // unless it matches the stored fileType perfectly.
        let wsFile = await WorkspaceFile.findOne({ documentId: docId, userId: req.user._id });

        const Document = require('../models/Document');
        const doc = await Document.findOne({ _id: docId, userId: req.user._id });

        if (!doc) {
            return res.status(404).json({ message: 'Document not found.' });
        }

        // Determine if we can use the cached WorkspaceFile
        const requestedExt = format ? format.replace('.', '') : null;
        const useCache = wsFile && (!requestedExt || wsFile.fileType === requestedExt);

        if (useCache) {
            const mimeType = mimeMap[wsFile.fileType] || 'application/octet-stream';
            res.setHeader('Content-Disposition', `attachment; filename="${wsFile.fileName}"`);
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', wsFile.size);
            return res.send(wsFile.fileData);
        }

        // Otherwise, generate on-the-fly (either first time or format mismatch like Export as PDF)
        const formatToUse = requestedExt || (doc.type === 'excel' ? 'xlsx' : doc.type === 'ppt' ? 'pptx' : 'docx');

        const { buffer, ext, mimeType, fileName } = await cloudExportService.generateBuffer(
            { name: doc.name, type: doc.type, content: doc.content, rawStructure: doc.rawStructure },
            formatToUse
        );
        const fileType = ext.replace('.', '');

        // Only save to WorkspaceFile if it's the primary format (matching doc.type) 
        // OR if no WorkspaceFile exists yet. We don't want to overwrite the primary .docx with a .pdf.
        const isPrimaryFormat = (doc.type === 'word' && fileType === 'docx') ||
            (doc.type === 'excel' && fileType === 'xlsx') ||
            (doc.type === 'ppt' && fileType === 'pptx');

        if (!wsFile || (isPrimaryFormat && wsFile.fileType !== fileType)) {
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

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (err) {
        console.error('[WorkspaceController] downloadFile error:', err);
        const status = err.message.includes('not supported') ? 400 : 500;
        res.status(status).json({ message: err.message || 'Failed to download file' });
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
