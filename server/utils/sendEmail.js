const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Email credentials (EMAIL_USER/EMAIL_PASS) are missing in environment variables.");
    }

    // 1. Create Transporter
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER, // Your Gmail
            pass: process.env.EMAIL_PASS, // Your App Password
        },
    });

    // 2. Define Email Options
    const mailOptions = {
        from: `"Nurotra Support" <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    // 3. Send Email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
