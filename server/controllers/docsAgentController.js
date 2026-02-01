const aiService = require("../services/aiService");

/**
 * Process Docs Agent Query
 * Route: POST /api/docs-agent/query
 */
const processQuery = async (req, res) => {
    const { prompt, history } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
    }

    try {
        const userContext = {
            name: req.user.name,
            role: req.user.role,
            niche: req.user.niche || "General"
        };

        const response = await aiService.processDocsAgentQuery(prompt, userContext, history);
        res.json(response);
    } catch (error) {
        console.error("Docs Agent Controller Error:", error);
        res.status(500).json({ message: "Failed to process agent query" });
    }
};

module.exports = {
    processQuery
};
