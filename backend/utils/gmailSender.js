require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

// Email delivery uses Resend's HTTPS API, which works reliably from Render.
const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
const emailFrom = String(process.env.EMAIL_FROM || "").trim();

// Sends one HTML email and throws a useful error when the provider rejects it.
const sendEmail = async ({ to, subject, html }) => {
    if (!resendApiKey) {
        throw new Error("Resend API key is not configured.");
    }

    if (!emailFrom) {
        throw new Error("EMAIL_FROM is not configured.");
    }

    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: emailFrom,
                to,
                subject,
                html,
                text
            }),
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || `Resend request failed (${response.status}).`);
        }

        return data;
    } finally {
        clearTimeout(timeout);
    }
};

module.exports = sendEmail;
