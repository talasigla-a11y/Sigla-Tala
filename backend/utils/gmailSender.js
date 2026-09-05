const nodemailer = require("nodemailer");

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const emailUser = String(process.env.EMAIL_USER || "").trim();
const emailPass = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "").trim();
const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
const emailFrom = String(process.env.EMAIL_FROM || emailUser).trim();

const sendWithResend = async ({ to, subject, html, text }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ from: emailFrom, to, subject, html, text }),
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || `Resend request failed (${response.status}).`);
        }
    } finally {
        clearTimeout(timeout);
    }
};

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
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    if (resendApiKey) {
        await sendWithResend({ to, subject, html, text });
        return;
    }

    const transporter = createTransporter();

    await transporter.sendMail({
        from: emailUser,
        to,
        subject,
        html,
        text
    });
};

module.exports = sendEmail;
