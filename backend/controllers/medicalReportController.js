const medicalReportModel = require("../models/medicalReportModel");
const userModel = require("../models/userModel");
const sendMedicalReport = require("../utils/sendMedicalReport");

const getPendingReports = (req, res) => {
    medicalReportModel.getPendingAppointments((err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to load pending reports." });
        res.json({ success: true, appointments: results });
    });
};

const getReports = (req, res) => {
    medicalReportModel.getAllReports((err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to load medical reports." });
        res.json({ success: true, reports: results });
    });
};

const createReport = (req, res) => {
    const appointmentId = Number(req.body.appointment_id);
    const userId = Number(req.body.user_id);
    const doctorName = String(req.body.doctor_name || "").trim();
    const recordedDate = String(req.body.recorded_date || "").trim();
    const diagnostic = String(req.body.diagnostic || "").trim();
    const notes = String(req.body.notes || "").trim();

    if (!appointmentId || !userId || !doctorName || !recordedDate || !diagnostic || !notes) {
        return res.status(400).json({ success: false, message: "All medical report fields are required." });
    }

    const report = { appointment_id: appointmentId, user_id: userId, doctor_name: doctorName, recorded_date: recordedDate, diagnostic, notes };
    medicalReportModel.createReport(report, async (err, result) => {
        if (err) {
            console.error("CREATE MEDICAL REPORT ERROR:", err);
            return res.status(500).json({ success: false, message: "Failed to save medical report." });
        }

        userModel.getProfileById(userId, async (profileErr, users) => {
            if (!profileErr && users.length) {
                try {
                    await sendMedicalReport(users[0].email, users[0].fullname, report);
                } catch (emailError) {
                    console.error("MEDICAL REPORT EMAIL ERROR:", emailError);
                    return res.status(201).json({ success: true, emailSent: false, message: "Report saved, but email could not be sent." });
                }
            }
            res.status(201).json({ success: true, emailSent: true, reportId: result.insertId });
        });
    });
};

module.exports = { getPendingReports, getReports, createReport };
