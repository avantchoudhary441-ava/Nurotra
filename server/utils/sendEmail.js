const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Email credentials (EMAIL_USER/EMAIL_PASS) are missing in environment variables.");
    }

    // 1. Create Transporter
    // 1. Create Transporter
    // Use explicit settings for better control and debugging
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        // Force IPv4 to avoid Node 17+ IPv6 issues
        family: 4,
        // Detailed logging
        logger: true,
        debug: true,
        // Increased timeouts (30s)
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
    });

    // Verify connection configuration
    try {
        await transporter.verify();
        console.log("Nodemailer connection verified successfully");
    } catch (error) {
        console.error("Nodemailer connection failed:", error);
        throw new Error("Email service connection failed: " + error.message);
    }

    // 2. Define Email Options
    const mailOptions = {
        from: `"Nurotra Support" <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    // 3. Send Email
    try {
        console.log(`Attempting to send email to ${options.email}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Failed to send email: " + error.message);
    }
};

module.exports = sendEmail;
