const medicalReportModel = require("../models/medicalReportModel");
const userModel = require("../models/userModel");
const appointmentModel = require("../models/appointmentModel");
const crypto = require("crypto");
const { sendAppointmentReceipt } = require("../utils/appointmentReceipt");
const sendMedicalReport = require("../utils/sendMedicalReport");

// Returns appointments that are ready for a medical report to be created.
const getPendingReports = (req, res) => {
    medicalReportModel.getPendingAppointments(req.user.id, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to load pending reports." });
        res.json({ success: true, appointments: results });
    });
};

// Retrieves medical reports created for appointments assigned to this worker.
const getReports = (req, res) => {
    medicalReportModel.getAllReports(req.user.id, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to load medical reports." });
        res.json({ success: true, reports: results });
    });
};

const getProfile = (userId) => new Promise((resolve, reject) => {
    userModel.getProfileById(userId, (err, users) => {
        if (err) return reject(err);
        if (!users.length) return reject(new Error("The signed-in worker account could not be found."));
        resolve(users[0]);
    });
});

const markReceiptSent = (appointmentId, tokenHash) => new Promise((resolve, reject) => {
    appointmentModel.markReceiptEmailSent(appointmentId, tokenHash, (err, result) => {
        if (err) return reject(err);
        if (!result.affectedRows) return reject(new Error("Receipt delivery could not be recorded."));
        resolve();
    });
});

const getLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const isValidDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// Saves a report and optional automatically accepted follow-up for the authenticated worker.
const createReport = async (req, res) => {
    const appointmentId = Number(req.body.appointment_id);
    const userId = Number(req.body.user_id);
    const recordedDate = String(req.body.recorded_date || "").trim();
    const diagnostic = String(req.body.diagnostic || "").trim();
    const notes = String(req.body.notes || "").trim();
    const followUpRequested = req.body.follow_up && req.body.follow_up.enabled === true;
    const followUpDate = String((req.body.follow_up || {}).date || "").trim();
    const followUpTime = String((req.body.follow_up || {}).time || "").trim();
    const validTimeSlots = new Set([
        "7:00 - 7:30", "7:30 - 8:00", "8:00 - 8:30", "8:30 - 9:00",
        "9:00 - 9:30", "9:30 - 10:00", "10:00 - 10:30", "10:30 - 11:00",
        "11:00 - 11:30", "11:30 - 12:00", "12:00 - 12:30", "12:30 - 1:00",
        "1:00 - 1:30", "1:30 - 2:00", "2:00 - 2:30", "2:30 - 3:00",
        "3:00 - 3:30", "3:30 - 4:00", "4:00 - 4:30", "4:30 - 5:00"
    ]);

    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1 ||
        !Number.isSafeInteger(userId) || userId < 1 ||
        !isValidDate(recordedDate) || !diagnostic || !notes) {
        return res.status(400).json({
            success: false,
            message: "A valid appointment, patient, recorded date, diagnosis, and medical notes are required."
        });
    }

    if (followUpRequested && (
        !isValidDate(followUpDate) ||
        followUpDate < getLocalDate() ||
        !validTimeSlots.has(followUpTime)
    )) {
        return res.status(400).json({
            success: false,
            message: "Choose a valid future follow-up date and an available 30-minute time slot."
        });
    }

    try {
        const worker = await getProfile(req.user.id);
        const report = {
            appointment_id: appointmentId,
            user_id: userId,
            doctor_name: worker.fullname,
            recorded_date: recordedDate,
            diagnostic,
            notes
        };
        const followUp = followUpRequested ? { date: followUpDate, time: followUpTime } : null;
        const receiptToken = followUp ? crypto.randomBytes(32).toString("hex") : null;
        const receiptTokenHash = receiptToken
            ? crypto.createHash("sha256").update(receiptToken).digest("hex")
            : null;

        medicalReportModel.createReport(report, worker, followUp, receiptTokenHash, async (err, result) => {
            if (err) {
                if (err.code === "REPORT_APPOINTMENT_NOT_ASSIGNED") {
                    return res.status(403).json({ success: false, message: err.message });
                }
                if (err.code === "FOLLOW_UP_SLOT_TAKEN") {
                    return res.status(409).json({ success: false, message: err.message });
                }
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ success: false, message: "A medical report already exists for this appointment." });
                }
                console.error("CREATE MEDICAL REPORT ERROR:", err);
                return res.status(500).json({ success: false, message: "Failed to save medical report." });
            }

            let emailSent = false;
            try {
                const patient = await getProfile(userId);
                if (!patient.email) throw new Error("The patient account has no email address.");
                await sendMedicalReport(patient.email, patient.fullname, report);
                emailSent = true;
            } catch (emailError) {
                console.error("MEDICAL REPORT EMAIL ERROR:", emailError);
            }

            let receiptEmailSent = null;
            let receiptDeliveryRecorded = null;
            if (result.followUpReceipt) {
                receiptEmailSent = false;
                receiptDeliveryRecorded = false;
                try {
                    if (!result.followUpReceipt.patient_email) {
                        throw new Error("The patient account has no email address for the follow-up receipt.");
                    }
                    await sendAppointmentReceipt(result.followUpReceipt, receiptToken);
                    receiptEmailSent = true;
                    try {
                        await markReceiptSent(result.followUpAppointmentId, receiptTokenHash);
                        receiptDeliveryRecorded = true;
                    } catch (recordError) {
                        console.error("FOLLOW-UP RECEIPT DELIVERY RECORD ERROR:", recordError);
                    }
                } catch (emailError) {
                    console.error("FOLLOW-UP RECEIPT EMAIL ERROR:", emailError);
                }
            }

            const partialEmailFailure = !emailSent || receiptEmailSent === false;
            return res.status(201).json({
                success: true,
                reportId: result.reportId,
                emailSent,
                followUpAppointmentId: result.followUpAppointmentId || null,
                receiptEmailSent,
                receiptDeliveryRecorded,
                message: partialEmailFailure
                    ? "Report and follow-up were saved, but one or more patient emails could not be sent."
                    : result.followUpAppointmentId
                        ? "Medical report saved and emailed. The follow-up was accepted and its verified receipt was emailed to the patient."
                        : "Medical report saved and emailed to the patient."
            });
        });
    } catch (error) {
        console.error("CREATE MEDICAL REPORT ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to load the signed-in worker profile." });
    }
};

module.exports = { getPendingReports, getReports, createReport };
