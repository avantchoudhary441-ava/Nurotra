const express = require('express');
const router = express.Router();
const docsAgentController = require('../controllers/docsAgentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/query', protect, docsAgentController.processQuery);
router.get('/projects', protect, docsAgentController.getProjects);
router.post('/projects', protect, docsAgentController.createProject);
router.get('/documents', protect, docsAgentController.getDocuments);
router.post('/documents', protect, docsAgentController.createDocument);
router.put('/documents/:id', protect, docsAgentController.updateDocument);
router.post('/extract-metadata', protect, docsAgentController.extractMetadata);
router.post('/structure-voice', protect, docsAgentController.structureVoicePrompt);
router.post('/automate-save', protect, docsAgentController.automateLocalSave);
router.post('/open-workspace', protect, docsAgentController.openWorkspace);

module.exports = router;
