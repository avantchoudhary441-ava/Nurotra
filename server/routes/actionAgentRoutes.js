const express = require("express");
const router = express.Router();
const actionAgentController = require("../controllers/actionAgentController");

// --- Core execution ---
router.post("/execute", actionAgentController.executeCommand);
router.get("/active-tasks", actionAgentController.getActiveTasks);
router.get("/history", actionAgentController.getHistory);

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
