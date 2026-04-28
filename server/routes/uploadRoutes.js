const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });
const { protect } = require('../middleware/authMiddleware');
const { parseDocument } = require('../utils/documentParser');
const Document = require('../models/Document');

// Debug wrapper or middleware logging
router.post('/', protect, (req, res, next) => {
    console.log("DEBUG: Upload request received at /api/upload");
    console.log("DEBUG: Headers:", req.headers['content-type']);
    next();
}, (req, res, next) => {
    upload.single('file')(req, res, function (err) {
        if (err) {
            console.error("DEBUG: Multer/Cloudinary Error:", err);
            return res.status(500).json({
                message: 'Multer/Upload error',
                error: err.message
            });
        }
        next();
    });
}, async (req, res) => {
    console.log("DEBUG: Multer finished processing");
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        let fileUrl = req.file.secure_url || req.file.path;
        if (fileUrl.startsWith('http:')) {
            fileUrl = fileUrl.replace('http:', 'https:');
        }

        // ─── NEW: Document Intelligence Integration ───
        console.log(`[Intelligence] Parsing document: ${req.file.originalname} (${req.file.mimetype})`);
        const extractedContent = await parseDocument(fileUrl, req.file.mimetype);

        const newDoc = new Document({
            userId: req.user._id,
            name: req.file.originalname,
            type: req.file.mimetype.includes('pdf') ? 'pdf' :
                req.file.mimetype.includes('word') ? 'word' :
                    req.file.mimetype.includes('spreadsheet') || req.file.mimetype.includes('excel') ? 'excel' :
                        req.file.mimetype.includes('presentation') ? 'ppt' : 'generic',
            content: extractedContent,
            url: fileUrl,  // <--- Linking the physical file asset
            metadata: {
                purpose: 'Uploaded for analysis',
                category: 'General',
                confidenceScore: 1.0
            }
        });

        await newDoc.save();
        console.log(`[Intelligence] Document saved with ${extractedContent.length} chars of content.`);

        res.json({
            url: fileUrl,
            filename: req.file.filename,
            documentId: newDoc._id,
            contentPreview: extractedContent.substring(0, 100) + '...'
        });
    } catch (err) {
        console.error("DEBUG: Error in upload response handler:", err);
        res.status(500).json({
            message: 'Internal handler error',
            error: err.message
        });
    }
});

module.exports = router;
