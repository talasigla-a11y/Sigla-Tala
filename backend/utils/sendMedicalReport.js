const sendEmail = require("./gmailSender");

const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Sends a generated medical report to the patient's registered email address.
module.exports = async (email, patientName, report) => {
    await sendEmail({
        to: email,
        subject: "Sigla Tala Medical Report",
        html: `
        <h2>Medical Report</h2>
        <p>Dear ${escapeHtml(patientName)},</p>
        <p>Your medical report is ready.</p>
        <p><strong>Health Worker:</strong> ${escapeHtml(report.doctor_name)}</p>
        <p><strong>Date:</strong> ${escapeHtml(report.recorded_date)}</p>
        <p><strong>Diagnosis:</strong> ${escapeHtml(report.diagnostic)}</p>
        <p><strong>Medical Notes:</strong></p>
        <p>${escapeHtml(report.notes).replace(/\r?\n/g, "<br>")}</p>
    `
    });
};
