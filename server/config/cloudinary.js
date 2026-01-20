const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        console.log("DEBUG: Cloudinary Storage Params called for:", file.originalname);
        // PRODUCTION CONFIGURATION
        // 1. Sanitize filename: remove extension, keep only alphanumeric to prevent URL encoding errors (401)
        let cleanName = file.originalname.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
        if (!cleanName) cleanName = "file";

        const p = {
            folder: 'nurotra_chat',
            // 'auto' mode allows Cloudinary to automatically classify files:
            // - Images/PDFs -> Viewable
            // - Zips/Others -> Raw/Download
            resource_type: 'auto',
            type: 'upload',
            // We do NOT manually set format or extension here. 
            // Cloudinary's 'auto' mode handles it safest matching the uploaded content.
            public_id: cleanName + '_' + Date.now(),
        };
        console.log("DEBUG: Cloudinary Params final:", p);
        return p;
    },
});

module.exports = { cloudinary, storage };
