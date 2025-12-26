const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });

// Debug wrapper or middleware logging
router.post('/', (req, res, next) => {
    console.log("Upload request received");
    next();
}, upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error("No file in req");
        return res.status(400).json({ message: 'No file uploaded' });
    }
    console.log("Full Cloudinary File Object:", req.file);

    // Prefer secure_url if available, otherwise force https on path
    let fileUrl = req.file.secure_url || req.file.path;
    if (fileUrl && fileUrl.startsWith('http:')) {
        fileUrl = fileUrl.replace('http:', 'https:');
    }

    res.json({ url: fileUrl, filename: req.file.filename });
});

module.exports = router;
