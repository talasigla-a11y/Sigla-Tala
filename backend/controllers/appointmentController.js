const appointmentModel = require("../models/appointmentModel");

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
    createAppointment,
    getMyAppointments,
    getAllAppointments,
    updateAppointmentStatus
};