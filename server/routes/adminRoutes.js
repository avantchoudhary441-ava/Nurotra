const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { protect, admin } = require("../middleware/authMiddleware");

router.use(protect);
router.use(admin);

router.get("/stats", adminController.getDashboardStats);
router.get("/users", adminController.getAdminUsers);
router.patch("/users/:userId", adminController.updateUser);
router.get("/users/:userId/timeline", adminController.getUserTimeline);
router.post("/bulk-action", adminController.triggerBulkAction);

module.exports = router;
