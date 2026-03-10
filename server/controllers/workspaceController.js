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

        // Only update WorkspaceFile if not a specialized conversion (like PDF) 
        // OR if it's the native format for this document type.
        // This prevents 'exports' from overwriting the primary editable document in the workspace.
        const nativeFormat = docData.type === 'excel' ? 'xlsx' : docData.type === 'ppt' ? 'pptx' : 'docx';

        if (!formatOverride || formatOverride === nativeFormat) {
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
        }

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
        let { format } = req.query;

        // Sanitize format - handle cases where it might be "undefined" or "null" as strings
        if (format === 'undefined' || format === 'null') format = null;

        console.log(`[Download] Request for docId: ${docId}, format param: ${format}`);

        const mimeMap = {
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'pdf': 'application/pdf'
        };

        // Try to find existing cloud file
        let wsFile = await WorkspaceFile.findOne({ documentId: docId, userId: req.user._id });
        console.log(`[Download] Found wsFile: ${!!wsFile}, type: ${wsFile?.fileType}`);

        // If a specific format is requested, we might need to regenerate even if wsFile exists
        // OR if wsFile exists but is the wrong format, we regenerate.
        const Document = require('../models/Document');
        const doc = await Document.findOne({ _id: docId, userId: req.user._id });

        if (!doc) {
            return res.status(404).json({ message: 'Document not found.' });
        }

        // VALIDATION: Prevent incompatible exports
        // Supported: 
        // - word -> docx, pdf
        // - excel -> xlsx, pdf
        // - ppt -> pptx, pdf
        // - generic -> docx, pdf
        if (format && format !== 'pdf') {
            const isExcel = doc.type === 'excel';
            const isPPT = doc.type === 'ppt';
            const isWord = doc.type === 'word' || doc.type === 'generic';

            if ((isExcel && format !== 'xlsx') ||
                (isPPT && format !== 'pptx') ||
                (isWord && format !== 'docx')) {
                return res.status(400).json({
                    message: "File Export not supported in this format, select the correct file type for smooth export."
                });
            }
        }

        let finalBuffer, finalFileName, finalMimeType;

        if (wsFile && (!format || wsFile.fileType === format)) {
            // Use existing file if format matches or no override requested
            finalBuffer = wsFile.fileData;
            finalFileName = wsFile.fileName;
            finalMimeType = mimeMap[wsFile.fileType] || 'application/octet-stream';
        } else {
            // Generate on-the-fly
            const formatToUse = format || (doc.type === 'excel' ? 'xlsx' : doc.type === 'ppt' ? 'pptx' : 'docx');

            const { buffer, ext, mimeType, fileName } = await cloudExportService.generateBuffer(
                { name: doc.name, type: doc.type, content: doc.content, rawStructure: doc.rawStructure },
                formatToUse
            );

            finalBuffer = buffer;
            finalFileName = fileName;
            finalMimeType = mimeType;

            // Only update WorkspaceFile if not a specialized conversion (like PDF)
            // so the 'primary' file remains the native format
            if (!format || format === (doc.type === 'excel' ? 'xlsx' : doc.type === 'ppt' ? 'pptx' : 'docx')) {
                await WorkspaceFile.findOneAndUpdate(
                    { userId: req.user._id, documentId: docId },
                    {
                        userId: req.user._id,
                        documentId: docId,
                        projectId: doc.projectId || null,
                        fileName: finalFileName,
                        fileType: ext.replace('.', ''),
                        fileData: finalBuffer,
                        size: finalBuffer.length
                    },
                    { upsert: true }
                );
            }
        }

        console.log(`[Download] Sending file: ${finalFileName} (${finalMimeType})`);
        res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
        res.setHeader('Content-Type', finalMimeType);
        res.setHeader('Content-Length', finalBuffer.length);
        res.send(finalBuffer);
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
