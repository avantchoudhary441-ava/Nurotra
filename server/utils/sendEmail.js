const { Resend } = require("resend");

const sendEmail = async (options) => {
    // Check for API key (critical for Resend)
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is missing in environment variables.");
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Default to 'onboarding@resend.dev' if no custom domain is set.
    // This allows immediate testing without domain verification.
    // Once a domain is verified in Resend, process.env.EMAIL_FROM can be set to 'support@yourdomain.com'
    const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";

    try {
        console.log(`Resend: Attempting to send email to ${options.email} from ${fromEmail}...`);

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [options.email], // Resend expects an array for 'to'
            subject: options.subject,
            html: options.message,
        });

        if (error) {
            console.error("Resend API Error:", error);
            throw new Error(`Resend Error: ${error.message} - ${error.name}`);
        }

        console.log("Resend Success:", data);
        return data;
    } catch (error) {
        // Catch-all for network or other unexpected errors
        console.error("Resend Send Failed:", error);
        throw new Error("Failed to send email via Resend: " + error.message);
    }
};

module.exports = sendEmail;
