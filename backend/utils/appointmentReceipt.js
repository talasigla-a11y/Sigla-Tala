const sendEmail = require("./gmailSender");

const escapeHtml = (value) =>
    String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const formatReceiptDate = (value) => {
    if (!value) return "Not provided";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};

const createReceiptUrl = (appointmentId, token) => {
    const frontendBaseUrl = process.env.FRONTEND_URL || "https://siglatala.com";
    const baseUrl = new URL(frontendBaseUrl);

    if (
        baseUrl.protocol !== "https:" &&
        !(baseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseUrl.hostname))
    ) {
        throw new Error("FRONTEND_URL must use HTTPS, except for localhost development.");
    }

    const receiptUrl = new URL("/appointment-receipt.html", baseUrl);
    receiptUrl.hash = new URLSearchParams({
        appointment_id: String(appointmentId),
        token
    }).toString();
    return receiptUrl.toString();
};

const createReceiptEmailHtml = (receipt, receiptUrl) => {
    const diagnosis = receipt.diagnostic
        ? `<tr><td style="padding:8px 0"><strong>Diagnosis</strong></td><td>${escapeHtml(receipt.diagnostic)}</td></tr>`
        : "";
    const notes = receipt.notes
        ? `<tr><td style="padding:8px 0"><strong>Medical notes</strong></td><td>${escapeHtml(receipt.notes).replace(/\r?\n/g, "<br>")}</td></tr>`
        : "";

    return `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1f2b;line-height:1.6">
          <div style="background:#1e8e5a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
            <h1 style="margin:0;font-size:22px">Sigla Tala Appointment Receipt</h1>
          </div>
          <div style="border:1px solid #d9dde3;border-top:0;padding:24px;border-radius:0 0 12px 12px">
            <p>Hello ${escapeHtml(receipt.patient_name)},</p>
            <p>Your appointment has been accepted by the health center.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0"><strong>Receipt number</strong></td><td>ST-${Number(receipt.id).toString().padStart(8, "0")}</td></tr>
              <tr><td style="padding:8px 0"><strong>Appointment</strong></td><td>${escapeHtml(receipt.appointment_type)}</td></tr>
              <tr><td style="padding:8px 0"><strong>Date</strong></td><td>${escapeHtml(formatReceiptDate(receipt.appointment_date))}</td></tr>
              <tr><td style="padding:8px 0"><strong>Time</strong></td><td>${escapeHtml(receipt.time_preference || "Not provided")}</td></tr>
              <tr><td style="padding:8px 0"><strong>Reason/details</strong></td><td>${escapeHtml(receipt.other_reason || "Not applicable")}</td></tr>
              <tr><td style="padding:8px 0"><strong>Responsible worker</strong></td><td>${escapeHtml(receipt.accepted_by_name)} (${escapeHtml(receipt.job_specification)})</td></tr>
              ${diagnosis}
              ${notes}
              <tr><td style="padding:8px 0"><strong>Status</strong></td><td>Accepted</td></tr>
            </table>
            <p style="margin:24px 0">
              <a href="${escapeHtml(receiptUrl)}" style="display:inline-block;background:#1e8e5a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Verify your appointment receipt</a>
            </p>
            <p>This private link verifies this receipt against the appointment recorded in Sigla Tala. Keep it private and use the button to view the verified appointment details.</p>
            <p>If you did not request this appointment, contact your health center.</p>
          </div>
        </div>
    `;
};

const sendAppointmentReceipt = async (receipt, token) => {
    const receiptUrl = createReceiptUrl(receipt.id, token);
    return sendEmail({
        to: receipt.patient_email,
        subject: `Sigla Tala appointment accepted — ST-${Number(receipt.id).toString().padStart(8, "0")}`,
        html: createReceiptEmailHtml(receipt, receiptUrl)
    });
};

module.exports = { sendAppointmentReceipt, formatReceiptDate };
