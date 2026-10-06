const sendEmail = require("./gmailSender");

const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Sends a generated medical report and optional follow-up schedule to the patient.
module.exports = async (email, patientName, report, followUp = null) => {
    const followUpSection = followUp
        ? `
        <hr>
        <h3>Follow-up Check-up</h3>
        <p>Your follow-up appointment has been accepted.</p>
        <p><strong>Date:</strong> ${escapeHtml(followUp.date)}</p>
        <p><strong>Time:</strong> ${escapeHtml(followUp.time)}</p>
        <p><strong>Health Worker:</strong> ${escapeHtml(followUp.workerName || report.doctor_name)}</p>
        <p>A separate verified appointment receipt has also been sent to this email.</p>
    `
        : "";

    await sendEmail({
        to: email,
        subject: followUp
            ? "Sigla Tala Medical Report and Follow-up Check-up"
            : "Sigla Tala Medical Report",
        html: `
        <h2>Medical Report</h2>
        <p>Dear ${escapeHtml(patientName)},</p>
        <p>Your medical report is ready.</p>
        <p><strong>Health Worker:</strong> ${escapeHtml(report.doctor_name)}</p>
        <p><strong>Date:</strong> ${escapeHtml(report.recorded_date)}</p>
        <p><strong>Diagnosis:</strong> ${escapeHtml(report.diagnostic)}</p>
        <p><strong>Medical Notes:</strong></p>
        <p>${escapeHtml(report.notes).replace(/\r?\n/g, "<br>")}</p>
        ${followUpSection}
    `
    });
};
