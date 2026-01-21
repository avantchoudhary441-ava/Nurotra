const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });

// Debug wrapper or middleware logging
router.post('/', (req, res, next) => {
    console.log("DEBUG: Upload request received at /api/upload");
    console.log("DEBUG: Headers:", req.headers['content-type']);
    next();
}, (req, res, next) => {
    upload.single('file')(req, res, function (err) {
        if (err) {
            console.error("DEBUG: Multer/Cloudinary Error:", err);
            // Provide more detail in the error response for debugging
            return res.status(500).json({
                message: 'Multer/Upload error',
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
        next();
    });
}, (req, res) => {
    console.log("DEBUG: Multer finished processing");
    if (!req.file) {
        console.error("DEBUG: No file in req after processing");
        return res.status(400).json({ message: 'No file uploaded or file rejected by Multer' });
    }
    console.log("DEBUG: Processed file:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
    });

    try {
        // Prefer secure_url if available, otherwise force https on path
        let fileUrl = req.file.secure_url || req.file.path;

        if (!fileUrl) {
            throw new Error("Cloudinary did not return a URL for the uploaded file.");
        }

        if (fileUrl.startsWith('http:')) {
            fileUrl = fileUrl.replace('http:', 'https:');
        }

        console.log("DEBUG: Returning file URL:", fileUrl);
        res.json({ url: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error("DEBUG: Error in upload response handler:", err);
        res.status(500).json({
            message: 'Internal handler error',
            error: err.message
        });
    }
});

module.exports = router;
