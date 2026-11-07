const appointmentModel = require("../models/appointmentModel");
const leadAdminModel = require("../models/leadAdminModel");
const crypto = require("crypto");
const { sendAppointmentReceipt, formatReceiptDate } = require("../utils/appointmentReceipt");

const jobSpecificationByAppointmentType = {
    "general consultation": "General Practitioner",
    checkup: "General Practitioner",
    "check-up": "General Practitioner",
    "prenatal check-up": "General Practitioner",
    dental: "Dentist",
    vaccination: "Vaccinator",
    "pediatric consultation": "Pediatrician",
    other: "Health Care workers"
};

const getJobSpecification = (appointmentType) =>
    jobSpecificationByAppointmentType[String(appointmentType).trim().toLowerCase()] || "Health Care workers";

const getProviderForAppointmentType = (req, res) => {
    const appointmentType = String(req.query.appointment_type || "").trim().toLowerCase();
    const appointmentDate = String(req.query.appointment_date || "").trim();
    const job_specification = jobSpecificationByAppointmentType[appointmentType];

    if (!job_specification) {
        return res.status(400).json({
            success: false,
            message: "Select a valid appointment type."
        });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
        return res.status(400).json({
            success: false,
            message: "Select an appointment date to see the scheduled worker."
        });
    }

    appointmentModel.getScheduledAdminByJobAndDate(job_specification, appointmentDate, (err, providers) => {
        if (err) {
            console.error("FIND APPOINTMENT PROVIDER ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to load the responsible health worker."
            });
        }

        return res.status(200).json({
            success: true,
            job_specification,
            appointment_date: appointmentDate,
            provider: providers.length ? providers[0] : null
        });
    });
};

const createAppointment = (req, res) => {
    try {
        const {
            appointment_type,
            appointment_date,
            time_preference,
            other_reason
        } = req.body;

        const user_id = req.user.id;

        if (
            !appointment_type ||
            !appointment_date
        ) {
            return res.status(400).json({
                success: false,
                message: "Appointment type and date are required."
            });
        }

        const normalizedTimePreference = time_preference && String(time_preference).trim() ? String(time_preference).trim() : null;
        const normalizedAppointmentType = String(appointment_type).trim().toLowerCase();
        const normalizedOtherReason =
            normalizedAppointmentType === "other" && other_reason
                ? String(other_reason).trim().slice(0, 500)
                : null;

        if (normalizedAppointmentType === "other" && !normalizedOtherReason) {
            return res.status(400).json({
                success: false,
                message: "Please tell us why you are choosing Other."
            });
        }

        const job_specification = getJobSpecification(appointment_type);
        const attachments = (req.files || []).map((file) => ({
            file_name: file.originalname,
            file_data: file.buffer
        }));

        const continueBooking = () => {
            appointmentModel.getScheduledAdminByJobAndDate(job_specification, appointment_date, (adminErr, admins) => {
                if (adminErr) {
                    console.error("FIND APPOINTMENT ADMIN ERROR:", adminErr);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to find a worker for this appointment type."
                    });
                }

                if (!admins.length) {
                    return res.status(409).json({
                        success: false,
                        message: `No ${job_specification} worker is scheduled on ${appointment_date}. Please choose another date.`
                    });
                }

                const assignedAdmin = admins[0];
                const appointment = {
                    user_id,
                    appointment_type,
                    job_specification,
                    assigned_admin_id: assignedAdmin.id,
                    assigned_admin_name: assignedAdmin.fullname,
                    appointment_date,
                    time_preference: normalizedTimePreference,
                    other_reason: normalizedOtherReason,
                    attachments
                };

                appointmentModel.createAppointment(appointment, (err, result) => {
                    if (err) {
                        console.error("CREATE APPOINTMENT ERROR:", err);

                        return res.status(500).json({
                            success: false,
                            message: "Failed to create appointment."
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Appointment created successfully!",
                        appointment: {
                            id: result.insertId,
                            user_id: appointment.user_id,
                            appointment_type: appointment.appointment_type,
                            job_specification: appointment.job_specification,
                            assigned_admin_id: appointment.assigned_admin_id,
                            assigned_admin_name: appointment.assigned_admin_name,
                            appointment_date: appointment.appointment_date,
                            time_preference: appointment.time_preference,
                            other_reason: appointment.other_reason,
                            attachments: attachments.map((attachment) => ({
                                id: null,
                                file_name: attachment.file_name
                            })),
                            status: "Pending"
                        }
                    });
                });
            });
        };

        if (!normalizedTimePreference) {
            continueBooking();
            return;
        }

        appointmentModel.getAppointmentByDateAndTime(appointment_date, normalizedTimePreference, (slotErr, slotResults) => {
            if (slotErr) {
                console.error("CHECK TIMESLOT ERROR:", slotErr);
                return res.status(500).json({
                    success: false,
                    message: "Failed to check appointment availability."
                });
            }

            if (slotResults.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `This time slot is already booked for ${appointment_date}. Please choose a different time.`
                });
            }

            continueBooking();
        });

    } catch (error) {
        console.error("APPOINTMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


const getMyAppointments = (req, res) => {
    try {
        const user_id = req.user.id;

        appointmentModel.getAppointmentsByUserId(
            user_id,
            (err, results) => {
                if (err) {
                    console.error("GET APPOINTMENTS ERROR:", err);

                    return res.status(500).json({
                        success: false,
                        message: "Failed to get appointments."
                    });
                }

                return res.status(200).json({
                    success: true,
                    appointments: results
                });
            }
        );

    } catch (error) {
        console.error("GET APPOINTMENTS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

const verifyAppointmentReceipt = (req, res) => {
    res.set("Cache-Control", "no-store");

    const appointmentId = Number(req.body.appointmentId);
    const token = String(req.body.token || "");

    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1 || !/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).json({
            success: false,
            message: "This receipt link is invalid."
        });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    appointmentModel.getAppointmentReceiptByToken(appointmentId, tokenHash, (err, receipt) => {
        if (err) {
            console.error("VERIFY APPOINTMENT RECEIPT ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to verify this appointment receipt."
            });
        }

        if (!receipt) {
            return res.status(404).json({
                success: false,
                message: "This receipt link is invalid or no longer active."
            });
        }

        return res.status(200).json({
            success: true,
            receipt: {
                appointment_id: receipt.id,
                patient_name: receipt.patient_name,
                appointment_type: receipt.appointment_type,
                appointment_date: formatReceiptDate(receipt.appointment_date),
                time_preference: receipt.time_preference,
                other_reason: receipt.other_reason,
                diagnosis: receipt.diagnostic,
                medical_notes: receipt.notes,
                job_specification: receipt.job_specification,
                accepted_by_name: receipt.accepted_by_name,
                status: receipt.status
            }
        });
    });
};


const getAllAppointments = (req, res) => {
    try {
        
        appointmentModel.getAllAppointments(
            req.user.id,
            (err, results) => {
                if (err) {
                    console.error("GET ALL APPOINTMENTS ERROR:", err);

                    return res.status(500).json({
                        success: false,
                        message: "Failed to get appointments."
                    });
                }

                return res.status(200).json({
                    success: true,
                    appointments: results
                });
            }
        );

    } catch (error) {
        console.error("GET ALL APPOINTMENTS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


const updateAppointmentStatus = (req, res) => {
    try {
        const { appointmentId, status } = req.body;

        if (!['Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be Pending, Accepted, Rejected, Completed, or Cancelled."
            });
        }

        if (status === "Accepted") {
            const id = Number(appointmentId);
            if (!Number.isSafeInteger(id) || id < 1) {
                return res.status(400).json({
                    success: false,
                    message: "A valid appointment is required."
                });
            }

            const receiptToken = crypto.randomBytes(32).toString("hex");
            const receiptTokenHash = crypto.createHash("sha256").update(receiptToken).digest("hex");

            return appointmentModel.prepareAcceptedAppointmentReceipt(
                id,
                req.user.id,
                receiptTokenHash,
                async (acceptErr, receipt) => {
                    if (acceptErr) {
                        console.error("ACCEPT APPOINTMENT ERROR:", acceptErr);
                        return res.status(500).json({
                            success: false,
                            message: "Failed to accept appointment."
                        });
                    }

                    if (!receipt) {
                        return res.status(409).json({
                            success: false,
                            message: "This appointment is no longer pending or its receipt was already sent."
                        });
                    }

                    leadAdminModel.logActivity(req.user.id, "appointment_status_updated", "appointment", id, "Status changed to Accepted", (logErr) => {
                        if (logErr) console.error("ACTIVITY LOG ERROR:", logErr);
                    });

                    if (!receipt.patient_email) {
                        return res.status(200).json({
                            success: true,
                            receiptEmailSent: false,
                            acceptedByName: receipt.accepted_by_name,
                            message: "Appointment accepted, but the patient's account has no email address for the receipt."
                        });
                    }

                    try {
                        await sendAppointmentReceipt(receipt, receiptToken);

                        appointmentModel.markReceiptEmailSent(id, receiptTokenHash, (markErr) => {
                            if (markErr) {
                                console.error("MARK APPOINTMENT RECEIPT SENT ERROR:", markErr);
                            }

                            return res.status(200).json({
                                success: true,
                                receiptEmailSent: true,
                                acceptedByName: receipt.accepted_by_name,
                                message: markErr
                                    ? `Appointment accepted and the receipt was emailed to ${receipt.patient_email}, but the delivery record could not be saved.`
                                    : `Appointment accepted. A verified receipt was emailed to ${receipt.patient_email}.`
                            });
                        });
                    } catch (emailErr) {
                        console.error("APPOINTMENT RECEIPT EMAIL ERROR:", emailErr);
                        return res.status(200).json({
                            success: true,
                            receiptEmailSent: false,
                            acceptedByName: receipt.accepted_by_name,
                            message: "Appointment accepted, but the receipt email could not be sent. Check email configuration and retry."
                        });
                    }
                }
            );
        }

        appointmentModel.updateAppointmentStatus(
            appointmentId,
            status,
            req.user.id,
            (err, result) => {
                if (err) {
                    console.error("UPDATE APPOINTMENT STATUS ERROR:", err);

                    return res.status(500).json({
                        success: false,
                        message: "Failed to update appointment status."
                    });
                }

                if (!result.affectedRows) {
                    return res.status(404).json({
                        success: false,
                        message: "Appointment not found or not assigned to this admin."
                    });
                }

                leadAdminModel.logActivity(req.user.id, "appointment_status_updated", "appointment", Number(appointmentId), `Status changed to ${status}`, (logErr) => {
                    if (logErr) console.error("ACTIVITY LOG ERROR:", logErr);
                });

                return res.status(200).json({
                    success: true,
                    message: "Appointment status updated successfully!"
                });
            }
        );

    } catch (error) {
        console.error("UPDATE APPOINTMENT STATUS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


module.exports = {
    getProviderForAppointmentType,
    verifyAppointmentReceipt,
    createAppointment,
    getMyAppointments,
    getAllAppointments,
    updateAppointmentStatus
};