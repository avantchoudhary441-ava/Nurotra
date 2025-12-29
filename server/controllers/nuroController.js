const NuroMemory = require('../models/NuroMemory');
const { aiService } = require('../services/aiService');

// Get the user's Nuro Memory (Core Stats)
exports.getNuroMemory = async (req, res) => {
    try {
        let memory = await NuroMemory.findOne({ userId: req.user.id });

        if (!memory) {
            // Initialize new memory for new user
            memory = await NuroMemory.create({
                userId: req.user.id,
                behavioralPatterns: [],
                metrics: { communicationClarity: 50, reliabilityScore: 50, trustIndex: 50 }
            });
        }

        res.status(200).json(memory);
    } catch (error) {
        res.status(500).json({ message: "Error fetching Nuro memory", error: error.message });
    }
};

// Trigger an analysis (e.g., after a chat closes)
exports.runPostMortem = async (req, res) => {
    try {
        const { collabId, chatLogs, outcome } = req.body;

        // 1. AI Analysis
        const analysis = await aiService.analyzeCollaborationBehavior({ chatLogs, outcome });

        // 2. Update Memory
        const memory = await NuroMemory.findOne({ userId: req.user.id });

        // Push to history
        memory.collabHistory.push({
            collabId: collabId || Date.now().toString(),
            overallScore: analysis.overallScore,
            scoreDelta: analysis.scoreDelta,
            positives: analysis.positives,
            negatives: analysis.negatives,
            rootCause: analysis.rootCause,
            fixes: analysis.fixes,
            predictedSuccessProbability: analysis.predictedSuccessProbability
        });

        // Update Moving Averages (Simple weighing: 70% old, 30% new)
        memory.metrics.communicationClarity = (memory.metrics.communicationClarity * 0.7) + (analysis.metrics.communicationClarity * 0.3);
        memory.metrics.reliabilityScore = (memory.metrics.reliabilityScore * 0.7) + (analysis.metrics.reliability * 0.3);
        memory.metrics.trustIndex = (memory.metrics.trustIndex * 0.7) + (analysis.metrics.trustIndex * 0.3);

        await memory.save();

        res.status(200).json({ success: true, analysis, memory });
    } catch (error) {
        console.error("Post-Mortem Error:", error);
        res.status(500).json({ message: "AI Analysis failed", error: error.message });
    }
};
