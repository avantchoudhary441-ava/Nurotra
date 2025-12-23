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
        port: 587, // Use 587 for TLS (more reliable in some cloud envs)
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        // Add timeouts to prevent hanging 
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,    // 5 seconds
        socketTimeout: 10000,     // 10 seconds
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
