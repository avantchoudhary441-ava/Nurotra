const WhatsAppAdapter = require("../services/communication/adapters/WhatsAppAdapter");
const whatsappAdapter = new WhatsAppAdapter();

/**
 * Handle Meta Webhook Verification (GET)
 */
exports.verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            console.log("[WhatsApp Webhook] Verified successfully.");
            return res.status(200).send(challenge);
        } else {
            console.warn("[WhatsApp Webhook] Verification failed. Token mismatch.");
            return res.sendStatus(403);
        }
    }
    res.sendStatus(400);
};

/**
 * Handle Incoming WhatsApp Events (POST)
 */
exports.handleWebhookPayload = async (req, res) => {
    try {
        const payload = req.body;
        console.log("[WhatsApp Webhook] Received event:", JSON.stringify(payload, null, 2));

        const normalizedMessage = await whatsappAdapter.handleWebhook(payload);

        if (normalizedMessage) {
            console.log("[WhatsApp Webhook] Normalized message:", normalizedMessage);
            
            // Emit to socket if possible
            const io = req.app.get("socketio");
            if (io) {
                io.emit("new_external_message", normalizedMessage);
            }
        }

        // Always return 200 to Meta to acknowledge receipt
        res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
        console.error("[WhatsApp Webhook] Error processing payload:", error.message);
        res.status(200).send("EVENT_RECEIVED"); // Still return 200 to avoid retries
    }
};
