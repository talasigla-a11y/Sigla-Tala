const appointmentModel = require("../models/appointmentModel");

// ================= CREATE APPOINTMENT =================
const createAppointment = (req, res) => {
    try {
        const {
            appointment_type,
            appointment_date,
            time_preference
        } = req.body;

        // Get the logged-in user's ID from JWT middleware
        const user_id = req.user.id;

        // Validate fields
        if (
            !appointment_type ||
            !appointment_date ||
            !time_preference
        ) {
            return res.status(400).json({
                success: false,
                message: "All appointment fields are required."
            });
        }

        const appointment = {
            user_id,
            appointment_type,
            appointment_date,
            time_preference,
            file_name: req.file ? req.file.originalname : null,
            file_data: req.file ? req.file.buffer : null
        };

        appointmentModel.createAppointment(
            appointment,
            (err, result) => {
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
                        ...appointment,
                        status: "Pending"
                    }
                });
            }
        );

    } catch (error) {
        console.error("APPOINTMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


// ================= GET MY APPOINTMENTS =================
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
const getAllAppointments = (req, res) => {
    try {
        // For demo mode (no auth required) or admin users
        // In production, add back verifyToken middleware to the route
        
        appointmentModel.getAllAppointments(
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
            (err, result) => {
                if (err) {
                    console.error("UPDATE APPOINTMENT STATUS ERROR:", err);

                    return res.status(500).json({
                        success: false,
                        message: "Failed to update appointment status."
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
    createAppointment,
    getMyAppointments,
    getAllAppointments,
    updateAppointmentStatus
};