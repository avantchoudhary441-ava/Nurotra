const express = require('express');
const router = express.Router();
const docsAgentController = require('../controllers/docsAgentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/query', protect, docsAgentController.processQuery);
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

module.exports = router;
