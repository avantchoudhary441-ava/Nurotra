const NuroMemory = require('../models/NuroMemory');
const mongoose = require('mongoose');
const { aiService } = require('../services/aiService');

// Get the user's Nuro Memory (Core Stats)
exports.getNuroMemory = async (req, res) => {
    try {
        let memory = await NuroMemory.findOne({ userId: req.user.id });

        if (!memory) {
            // Initialize new memory for new user with some realistic baseline data for the intelligence layer
            memory = await NuroMemory.create({
                userId: req.user.id,
                behavioralPatterns: [],
                metrics: {
                    communicationClarity: 50,
                    reliabilityScore: 50,
                    trustIndex: 50,
                    expectationAlignment: 50,
                    compatibilityScore: 50,
                    experienceIndex: 50,
                    safetyComplianceScore: 50
                },
                behavioralMetrics: {
                    avgReplyTimeTrend: [],
                    negotiationTime: 0,
                    executionDelay: 0,
                    aiInsightNote: "Awaiting more collaboration data to form behavioral insights."
                },
                audienceAlignment: {
                    primaryFit: "None detected",
                    secondaryFit: "None detected",
                    avoidZone: [],
                    nicheStats: []
                },
                historicalPatterns: [
                    "Perform initial collaborations to detect your unique performance patterns."
                ],
                aiLearnings: [
                    "Nurotra is currently calibrating to your professional tone and response style."
                ],
                milestones: [
                    { label: "Onboarded to Nurotra", date: new Date(), type: 'fact' }
                ],
                trustSnapshot: {
                    compositeScore: 70,
                    status: 'Stable',
                    statusMessage: "Your trust standing across identity, behaviour, and reliability."
                },
                trustPillars: {
                    identity: { emailVerified: true, socialVerified: false, authenticityRate: 100, identityScore: 100 },
                    behavioralIntegrity: { spamSignal: 'Low', fakeFollowerEstimate: 0, interactionHealth: 100, integrityScore: 100 },
                    transactionalTrust: { paymentSafetyScore: 100, agreementTransparency: 100, disputeRate: 0, transactionalScore: 100 },
                    communitySignal: { reputationHeatmap: [], socialProofScore: 50 }
                }
            });
        }

        // If memory exists but new fields are missing (migration), update it
        let modified = false;
        if (!memory.behavioralMetrics) {
            memory.behavioralMetrics = { avgReplyTimeTrend: [], negotiationTime: 0, executionDelay: 0, aiInsightNote: "" };
            modified = true;
        }
        if (!memory.audienceAlignment) {
            memory.audienceAlignment = { primaryFit: "None detected", secondaryFit: "None detected", avoidZone: [], nicheStats: [] };
            modified = true;
        }
        if (!memory.trustSnapshot) {
            memory.trustSnapshot = { compositeScore: 70, status: 'Stable', statusMessage: "Your trust standing across identity, behaviour, and reliability." };
            modified = true;
        }
        if (!memory.trustPillars) {
            memory.trustPillars = {
                identity: { emailVerified: true, socialVerified: false, authenticityRate: 100, identityScore: 100 },
                behavioralIntegrity: { spamSignal: 'Low', fakeFollowerEstimate: 0, interactionHealth: 100, integrityScore: 100 },
                transactionalTrust: { paymentSafetyScore: 100, agreementTransparency: 100, disputeRate: 0, transactionalScore: 100 },
                communitySignal: { reputationHeatmap: [], socialProofScore: 50 }
            };
            modified = true;
        }
        // --- DATA INTEGRITY FIX: Resolve raw IDs/Chat IDs to Names in History ---
        const User = require('../models/User');
        const Chat = require('../models/Chat'); // Import Chat for fallback resolution
        let historyModified = false;

        if (memory.collabHistory && memory.collabHistory.length > 0) {
            for (let entry of memory.collabHistory) {
                // Check if partnerName is an ID or missing
                const isObjectId = /^[0-9a-fA-F]{24}$/.test(entry.partnerName || "");
                const hasNoName = !entry.partnerName || entry.partnerName === "Anonymous Partner" || entry.partnerName === entry.collabId;

                if (isObjectId || hasNoName) {
                    // Resolution Strategy 1: The ID is a User ID
                    const potentialUserId = isObjectId ? entry.partnerName : entry.collabId;

                    if (mongoose.Types.ObjectId.isValid(potentialUserId)) {
                        // Try User lookup first
                        let user = await User.findById(potentialUserId).select('name');

                        if (!user) {
                            // Resolution Strategy 2: The ID is a Chat ID
                            const chat = await Chat.findById(potentialUserId).populate('users', 'name');
                            if (chat && chat.users) {
                                // Find the OTHER user in the chat
                                const partner = chat.users.find(u => u._id.toString() !== req.user.id);
                                if (partner) {
                                    entry.partnerName = partner.name;
                                    historyModified = true;
                                }
                            }
                        } else {
                            entry.partnerName = user.name;
                            historyModified = true;
                        }
                    }
                }
            }
        }


        if (modified || historyModified) await memory.save();

        res.status(200).json(memory);
    } catch (error) {
        res.status(500).json({ message: "Error fetching Nuro memory", error: error.message });
    }
};

// Trigger an analysis (e.g., after a chat closes)
exports.runPostMortem = async (req, res) => {
    try {
        const { collabId, chatLogs, outcome, partnerName } = req.body;

        // 1. AI Analysis
        const analysis = await aiService.analyzeCollaborationBehavior({ chatLogs, outcome });

        // 2. Update Memory
        const memory = await NuroMemory.findOne({ userId: req.user.id });

        // Push to history
        memory.collabHistory.push({
            collabId: collabId || Date.now().toString(),
            partnerName: partnerName || "Anonymous Partner",
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

// Get Public Nuro Memory for Inspection (Strictly limited fields)
exports.getPublicNuroMemory = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find memory for the target user
        const memory = await NuroMemory.findOne({ userId }).select(
            'metrics trustSnapshot trustPillars milestones'
        );

        if (!memory) {
            return res.status(404).json({ message: "Nuro Memory not found for this user" });
        }

        // Return only the analytical/public parts
        res.status(200).json(memory);
    } catch (error) {
        res.status(500).json({ message: "Error fetching public Nuro memory", error: error.message });
    }
};

// PERSISTENCE: Mark a guide as seen in the cloud
exports.markGuideSeen = async (req, res) => {
    try {
        const { guideId } = req.body;
        const memory = await NuroMemory.findOne({ userId: req.user.id });

        if (memory && !memory.seenGuides.includes(guideId)) {
            memory.seenGuides.push(guideId);
            await memory.save();
        }

        res.status(200).json({ success: true, seenGuides: memory ? memory.seenGuides : [] });
    } catch (error) {
        res.status(500).json({ message: "Error marking guide as seen", error: error.message });
    }
};

// FEEDBACK: Save micro-feedback to memory
exports.saveFeedback = async (req, res) => {
    try {
        const { response, context } = req.body;
        const memory = await NuroMemory.findOne({ userId: req.user.id });

        if (memory) {
            // Log as an intervention action or specific feedback node
            memory.interventionHistory.push({
                timestamp: new Date(),
                context: context || "Engagement Question",
                trigger: "User Feedback",
                adviceGiven: "Micro-question prompt",
                userAction: response
            });

            // Update metrics based on feedback (optional - e.g., if response is 'Success')
            if (response === 'Yes') {
                memory.metrics.reliabilityScore = Math.min(100, memory.metrics.reliabilityScore + 1);
            }

            await memory.save();
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Error saving feedback", error: error.message });
    }
};
