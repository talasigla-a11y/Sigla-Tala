const sendEmail = require("./gmailSender");

// Sends a generated medical report to the patient's registered email address.
module.exports = async (email, patientName, report) => {
    await sendEmail({
        to: email,
        subject: "Sigla Tala Medical Report",
        html: `
        <h2>Medical Report</h2>
        <p>Dear ${patientName},</p>
        <p>Your medical report is ready.</p>
        <p><strong>Doctor/Admin:</strong> ${report.doctor_name}</p>
        <p><strong>Date:</strong> ${report.recorded_date}</p>
        <p><strong>Diagnostic:</strong> ${report.diagnostic}</p>
        <p><strong>Medical Notes:</strong></p>
        <p>${report.notes.replace(/\n/g, "<br>")}</p>
    `
    });
};
