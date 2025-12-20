const express = require("express");
const router = express.Router();
const matchController = require("../controllers/matchController");
const { protect } = require("../middleware/authMiddleware");

// Use POST so we can pass the requester's info securely if needed, 
// or simple GET with params. Using POST for extensibility.
router.post("/brand", protect, matchController.matchForBrand);
router.post("/influencer", protect, matchController.matchForInfluencer);

module.exports = router;
