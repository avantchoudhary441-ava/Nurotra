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
            return res.status(500).json({ message: 'Multer error', error: err.message });
        }
        next();
    });
}, (req, res) => {
    console.log("DEBUG: Multer finished processing");
    if (!req.file) {
        console.error("DEBUG: No file in req after processing");
        return res.status(400).json({ message: 'No file uploaded' });
    }
    console.log("DEBUG: Full Cloudinary File Object:", req.file);

    try {
        // Prefer secure_url if available, otherwise force https on path
        let fileUrl = req.file.secure_url || req.file.path;
        if (fileUrl && fileUrl.startsWith('http:')) {
            fileUrl = fileUrl.replace('http:', 'https:');
        }

        res.json({ url: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error("DEBUG: Error in upload response handler:", err);
        res.status(500).json({ message: 'Handler error', error: err.message });
    }
});

module.exports = router;
