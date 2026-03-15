const express = require('express');
const router = express.Router();
const multer = require('multer');
const docsAgentController = require('../controllers/docsAgentController');
const { protect } = require('../middleware/authMiddleware');

// In-memory storage for analysis file uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB max

router.post('/query', protect, (req, res, next) => {
    console.log(`[DocsAgent] Query received: "${req.body.prompt?.substring(0, 50)}..."`);
    next();
}, docsAgentController.processQuery);
router.post('/analyze', protect, upload.array('files', 10), docsAgentController.analyzeDocuments);
router.get('/projects', protect, docsAgentController.getProjects);
router.post('/projects', protect, docsAgentController.createProject);
router.get('/documents', protect, docsAgentController.getDocuments);
router.get('/documents/search', protect, docsAgentController.searchDocuments);
router.post('/documents', protect, docsAgentController.createDocument);
router.put('/documents/:id', protect, docsAgentController.updateDocument);
router.delete('/documents/:id', protect, docsAgentController.deleteDocument);
router.post('/extract-metadata', protect, docsAgentController.extractMetadata);
router.post('/structure-voice', protect, docsAgentController.structureVoicePrompt);
router.post('/automate-save', protect, docsAgentController.automateLocalSave);
router.post('/open-workspace', protect, docsAgentController.openWorkspace);
router.post('/documents/:id/mark-revaluated', protect, docsAgentController.markRevaluated);
router.post('/extract-command', protect, upload.array('files', 5), docsAgentController.extractCommands);

module.exports = router;
