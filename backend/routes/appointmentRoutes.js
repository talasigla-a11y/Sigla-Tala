const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointmentController");
const verifyToken = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Create appointment
router.post(
    "/",
    verifyToken,
    upload.single("attachment"),
    appointmentController.createAppointment
);

// Get logged-in user's appointments
router.get(
    "/my-appointments",
    verifyToken,
    appointmentController.getMyAppointments
);

// Get all appointments (admin only) - Public demo version for development
router.get(
    "/admin/all-appointments",
    appointmentController.getAllAppointments
);

// Update appointment status (admin only) - Public demo version for development
router.put(
    "/admin/update-status",
    appointmentController.updateAppointmentStatus
);

module.exports = router;