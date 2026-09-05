const nodemailer = require("nodemailer");

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const emailUser = String(process.env.EMAIL_USER || "").trim();
const emailPass = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "").trim();

const createTransporter = () => {
    if (!emailUser || !emailPass) {
        throw new Error("SMTP email credentials are not configured.");
    }

    const smtpPort = Number(process.env.SMTP_PORT) || 587;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: smtpPort,
        secure: smtpPort === 465,
        requireTLS: smtpPort === 587,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
        tls: {
            minVersion: "TLSv1.2"
        },
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
};

const sendEmail = async ({ to, subject, html }) => {
    const transporter = createTransporter();

    await transporter.sendMail({
        from: emailUser,
        to,
        subject,
        html,
        text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    });
};

module.exports = sendEmail;
