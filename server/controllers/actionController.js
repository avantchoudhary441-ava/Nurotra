const actionService = require('../services/actionService');
const User = require('../models/User');

/**
 * Action Controller: Orchestrates tool-specific executions.
 */

exports.executeAction = async (req, res) => {
    try {
        const { actionIntent } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check for specific tool auth before proceeding
        const tool = actionIntent.tool.toLowerCase();
        
        if (tool === 'google sheets' || tool === 'google meet') {
            if (!user.googleAccessToken) {
                return res.status(401).json({ 
                    success: false, 
                    type: 'INTERVENTION_REQUIRED',
                    message: "Google account not connected or session expired.",
                    integration: 'google'
                });
            }
        }

        if (tool === 'zoom') {
            if (!user.zoomAccessToken) {
                return res.status(401).json({ 
                    success: false, 
                    type: 'INTERVENTION_REQUIRED',
                    message: "Zoom account not connected.",
                    integration: 'zoom'
                });
            }
        }

        // Call the service to execute
        const result = await actionService.executeToolAction(user, actionIntent);
        
        // Check if a pivot (alternative path) was taken
        const wasRecovered = result.provider && result.provider.toLowerCase() !== actionIntent.tool.toLowerCase();

        res.status(200).json({
            success: true,
            status: wasRecovered ? 'RECOVERED' : 'COMPLETED',
            message: wasRecovered 
                ? `Automatic recovery: Switched from ${actionIntent.tool} to ${result.provider}` 
                : "Action executed successfully",
            result
        });

    } catch (error) {
        console.error("[ActionController] Execution Error:", error);

        // Determine if it's a fatal error or something that needs user intervention
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes("not found") || errorMessage.includes("invalid") || errorMessage.includes("permission")) {
            return res.status(400).json({ 
                success: false, 
                type: 'INTERVENTION_REQUIRED',
                message: `Action Failed: ${error.message}. Please provide the correct details.`,
                error: error.message
            });
        }

        res.status(500).json({ 
            success: false, 
            message: `Execution failed after retries: ${error.message}`, 
            error: error.message 
        });
    }
};

exports.getIntegrationStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({
            success: true,
            status: {
                google: !!user.googleAccessToken,
                zoom: !!user.zoomAccessToken,
                whatsapp: !!user.whatsappConnected // assuming this exists or similar
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching status" });
    }
};
