const express = require('express');
const router = express.Router();
const { downloadFile, listWorkspace, deleteFile } = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');

// List all cloud workspace files for the logged-in user
router.get('/list', protect, listWorkspace);

// Download a specific file by its Document ID
router.get('/download/:docId', protect, downloadFile);

// Delete a workspace file by its Document ID
router.delete('/:docId', protect, deleteFile);

module.exports = router;
