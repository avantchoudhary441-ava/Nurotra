const express = require("express");
const router = express.Router();
const actionAgentController = require("../controllers/actionAgentController");
const { protect } = require("../middleware/authMiddleware");

// Apply protect middleware to all action agent routes to ensure correct userId attribution
router.use(protect);

// --- Core execution ---
router.post("/execute", actionAgentController.executeCommand);
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

module.exports = router;
