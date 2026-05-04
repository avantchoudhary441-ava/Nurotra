const express = require("express");
const router = express.Router();
const actionAgentController = require("../controllers/actionAgentController");
const extensionBridgeController = require("../controllers/extensionBridgeController");
const { protect } = require("../middleware/authMiddleware");

// ─── EXTENSION BRIDGE (No auth middleware — uses own token system) ───
router.post("/extension/auth", extensionBridgeController.extensionAuth);
router.get("/extension/poll", extensionBridgeController.extensionPoll);
router.post("/extension/report", extensionBridgeController.extensionReport);
router.post("/extension/result", extensionBridgeController.extensionResult);
router.post("/extension/frame", extensionBridgeController.extensionFrame);
router.post("/extension/solve", extensionBridgeController.extensionSolve);

// Apply protect middleware to all other action agent routes
router.use(protect);

router.get("/extension/status", (req, res) => {
    const isConnected = extensionBridgeController.isExtensionConnected(req.user._id);
    res.json({ success: true, isConnected });
});

// --- Core execution ---
router.post("/execute", actionAgentController.executeCommand);
router.post("/resume-identity", actionAgentController.resumeIdentity);
router.post("/confirm/:id", actionAgentController.confirmWorkflow);
router.post("/intervention/:id", actionAgentController.submitIntervention);
router.get("/active-tasks", actionAgentController.getActiveTasks);
router.post("/acknowledge/:workflowId", actionAgentController.acknowledgeTask);
router.get("/history", actionAgentController.getHistory);
router.post("/stop/:id", actionAgentController.stopWorkflow);
router.post("/pause/:id", actionAgentController.pauseWorkflow);
router.get("/chat", actionAgentController.getChatHistory);
router.delete("/chat", actionAgentController.clearChatHistory);
router.post("/restart-browser", actionAgentController.restartBrowser);
router.get("/suggestions", actionAgentController.getSuggestions);

// --- Event Rules (Automation) ---
router.post("/event-rules", actionAgentController.createEventRule);
router.get("/event-rules", actionAgentController.getEventRules);
router.delete("/event-rules/:id", actionAgentController.deleteEventRule);
router.patch("/event-rules/:id/toggle", actionAgentController.toggleEventRule);

// --- Webhook Trigger ---
router.post("/webhook/:webhookId", actionAgentController.triggerWebhook);

// --- Execution Logs ---
router.get("/logs/:workflowId", actionAgentController.getWorkflowLogs);

// --- Extension Token for UI ---
router.get("/extension-token", (req, res) => {
    const crypto = require('crypto');
    const extensionToken = crypto.randomUUID(); // Fresh, unique token every time
    
    // Link this fresh token to the user
    extensionBridgeController.registerExtensionToken(extensionToken, req.user._id);
    
    res.json({ success: true, token: extensionToken });
});

module.exports = router;
