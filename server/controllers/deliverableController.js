const Deliverable = require('../models/Deliverable');
const NuroMemory = require('../models/NuroMemory');
const { analyzeDeliverable } = require('../services/aiService');

// Upload a new deliverable
exports.uploadDeliverable = async (req, res) => {
    try {
        const { fileUrl, fileName, fileType, tags } = req.body;

        if (!fileUrl || !fileName) {
            return res.status(400).json({ message: "File URL and name are required." });
        }

        // 1. AI Analysis
        const analysis = await analyzeDeliverable({ fileName, fileType });

        // 2. Save Deliverable
        const deliverable = await Deliverable.create({
            userId: req.user.id,
            fileName,
            fileUrl,
            fileType,
            category: analysis.category,
            tags: tags || [],
            aiAnalysis: {
                summary: analysis.summary,
                keyTakeaways: analysis.keyTakeaways,
                scoreImpact: analysis.scoreImpact
            }
        });

        // 3. Update Nuro Memory Scores
        let memory = await NuroMemory.findOne({ userId: req.user.id });
        if (!memory) {
            memory = await NuroMemory.create({ userId: req.user.id });
        }

        // Apply score impacts (clamped 0-100)
        const applyImpact = (current, impact) => Math.min(100, Math.max(0, current + (impact || 0)));

        memory.metrics.compatibilityScore = applyImpact(memory.metrics.compatibilityScore, analysis.scoreImpact.compatibility);
        memory.metrics.experienceIndex = applyImpact(memory.metrics.experienceIndex, analysis.scoreImpact.experience);
        memory.metrics.trustIndex = applyImpact(memory.metrics.trustIndex, analysis.scoreImpact.trust);
        memory.metrics.safetyComplianceScore = applyImpact(memory.metrics.safetyComplianceScore, analysis.scoreImpact.safety);
        memory.metrics.reliabilityScore = applyImpact(memory.metrics.reliabilityScore, analysis.scoreImpact.reliability);

        await memory.save();

        res.status(201).json({
            message: "Deliverable uploaded and analyzed successfully.",
            deliverable,
            scoreImpact: analysis.scoreImpact
        });

    } catch (error) {
        console.error("Upload Deliverable Error:", error);
        res.status(500).json({ message: "Failed to upload deliverable", error: error.message });
    }
};

// Get all deliverables for the logged-in user
exports.getUserDeliverables = async (req, res) => {
    try {
        const deliverables = await Deliverable.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(deliverables);
    } catch (error) {
        res.status(500).json({ message: "Error fetching deliverables", error: error.message });
    }
};

// Get public deliverables for a specific user (by Nuro ID or User ID)
exports.getPublicDeliverables = async (req, res) => {
    try {
        const { userId } = req.params;
        const deliverables = await Deliverable.find({ userId, isPublic: true }).sort({ createdAt: -1 });
        res.status(200).json(deliverables);
    } catch (error) {
        res.status(500).json({ message: "Error fetching public deliverables", error: error.message });
    }
};

// Delete a deliverable
exports.deleteDeliverable = async (req, res) => {
    try {
        const deliverable = await Deliverable.findOne({ _id: req.params.id, userId: req.user.id });
        if (!deliverable) {
            return res.status(404).json({ message: "Deliverable not found or unauthorized." });
        }

        await deliverable.deleteOne();
        res.status(200).json({ message: "Deliverable deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Error deleting deliverable", error: error.message });
    }
};
