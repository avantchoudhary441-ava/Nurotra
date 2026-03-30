const axios = require('axios');
require('dotenv').config();

async function testWhatsApp() {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const recipient = "918130888405"; // Your whitelisted number

    console.log("--- WHATSAPP DIAGNOSIS ---");
    console.log("Phone ID:", phoneId);
    console.log("Token Length:", token ? token.length : 0);
    console.log("Base URL:", `https://graph.facebook.com/v22.0/${phoneId}/messages`);

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${phoneId}/messages`,
            {
                messaging_product: "whatsapp",
                to: recipient,
                type: "text",
                text: { body: "Nurotra Diagnostic Test" }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log("✅ SUCCESS!");
        console.log("Response:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log("❌ FAILED!");
        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Error Detail:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.log("Error Message:", error.message);
        }
    }
}

testWhatsApp();
