const appointmentModel = require("../models/appointmentModel");
const crypto = require("crypto");
const sendEmail = require("../utils/gmailSender");

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

// Resolves an appointment type to the specialty of its responsible admin.
const getJobSpecification = (appointmentType) =>
    jobSpecificationByAppointmentType[String(appointmentType).trim().toLowerCase()] || "Health Care workers";

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
    const patientName = escapeHtml(receipt.patient_name);
    const appointmentType = escapeHtml(receipt.appointment_type);
    const appointmentDate = escapeHtml(formatReceiptDate(receipt.appointment_date));
    const appointmentTime = escapeHtml(receipt.time_preference || "Not provided");
    const appointmentReason = escapeHtml(receipt.other_reason || "Not applicable");
    const workerName = escapeHtml(receipt.accepted_by_name);
    const specialty = escapeHtml(receipt.job_specification);
    const safeReceiptUrl = escapeHtml(receiptUrl);

    return `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1f2b;line-height:1.6">
          <div style="background:#1e8e5a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
            <h1 style="margin:0;font-size:22px">Sigla Tala Appointment Receipt</h1>
          </div>
          <div style="border:1px solid #d9dde3;border-top:0;padding:24px;border-radius:0 0 12px 12px">
            <p>Hello ${patientName},</p>
            <p>Your appointment has been accepted by the health center.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0"><strong>Receipt number</strong></td><td>ST-${Number(receipt.id).toString().padStart(8, "0")}</td></tr>
              <tr><td style="padding:8px 0"><strong>Appointment</strong></td><td>${appointmentType}</td></tr>
              <tr><td style="padding:8px 0"><strong>Date</strong></td><td>${appointmentDate}</td></tr>
              <tr><td style="padding:8px 0"><strong>Time</strong></td><td>${appointmentTime}</td></tr>
              <tr><td style="padding:8px 0"><strong>Reason/details</strong></td><td>${appointmentReason}</td></tr>
              <tr><td style="padding:8px 0"><strong>Responsible worker</strong></td><td>${workerName} (${specialty})</td></tr>
              <tr><td style="padding:8px 0"><strong>Status</strong></td><td>Accepted</td></tr>
            </table>
            <p style="margin:24px 0">
              <a href="${safeReceiptUrl}" style="display:inline-block;background:#1e8e5a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Verify your appointment receipt</a>
            </p>
            <p>This private link verifies this receipt against the appointment recorded in Sigla Tala. Keep it private and use the button to view the verified appointment details.</p>
            <p>If you did not request this appointment, contact your health center.</p>
          </div>
        </div>
    `;
};

// Looks up the worker who would be assigned to the selected appointment type.
const getProviderForAppointmentType = (req, res) => {
    const appointmentType = String(req.query.appointment_type || "").trim().toLowerCase();
    const job_specification = jobSpecificationByAppointmentType[appointmentType];

    if (!job_specification) {
        return res.status(400).json({
            success: false,
            message: "Select a valid appointment type."
        });
    }

    appointmentModel.getAdminByJobSpecification(job_specification, (err, providers) => {
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
            provider: providers.length ? providers[0] : null
        });
    });
};

// ================= CREATE APPOINTMENT =================
// Validates patient input, attaches the logged-in user ID, and creates an appointment.
const createAppointment = (req, res) => {
    try {
        const {
            appointment_type,
            appointment_date,
            time_preference,
            other_reason
        } = req.body;

        // Get the logged-in user's ID from JWT middleware
        const user_id = req.user.id;

        // Validate fields
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
            appointmentModel.getAdminByJobSpecification(job_specification, (adminErr, admins) => {
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
                        message: `No worker is configured for ${job_specification} appointments. Ask a worker to set their Job Specification.`
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


// ================= GET MY APPOINTMENTS =================
// Loads only the appointments owned by the authenticated patient.
const getMyAppointments = (req, res) => {
    try {
        // Get logged-in user's ID from JWT
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

// Verifies a private emailed receipt link without exposing appointments by ID alone.
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
                job_specification: receipt.job_specification,
                accepted_by_name: receipt.accepted_by_name,
                status: receipt.status
            }
        });
    });
};


// ================= GET ALL APPOINTMENTS (ADMIN) =================
// Loads appointments assigned to the authenticated administrator.
const getAllAppointments = (req, res) => {
    try {
        // For demo mode (no auth required) or admin users
        // In production, add back verifyToken middleware to the route
        
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


// ================= UPDATE APPOINTMENT STATUS =================
// Validates an admin decision and persists the new appointment status.
const updateAppointmentStatus = (req, res) => {
    try {
        const { appointmentId, status } = req.body;

        // Validate status (check for capitalized versions)
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

                    if (!receipt.patient_email) {
                        return res.status(200).json({
                            success: true,
                            receiptEmailSent: false,
                            acceptedByName: receipt.accepted_by_name,
                            message: "Appointment accepted, but the patient's account has no email address for the receipt."
                        });
                    }

                    try {
                        const receiptUrl = createReceiptUrl(id, receiptToken);
                        await sendEmail({
                            to: receipt.patient_email,
                            subject: `Sigla Tala appointment accepted — ST-${id.toString().padStart(8, "0")}`,
                            html: createReceiptEmailHtml(receipt, receiptUrl)
                        });

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