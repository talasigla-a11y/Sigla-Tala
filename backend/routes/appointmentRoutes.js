const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointmentController");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");
const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only PDF, JPG, PNG, WEBP, and DOC/DOCX files are allowed."));
        }

        cb(null, true);
    }
});

// Creates an appointment after authenticating the patient and processing an optional attachment.
// Create appointment
router.post(
    "/",
    verifyToken,
    upload.single("attachment"),
    appointmentController.createAppointment
);

// Returns only the appointments belonging to the authenticated patient.
// Get logged-in user's appointments
router.get(
    "/my-appointments",
    verifyToken,
    appointmentController.getMyAppointments
);

// Admin endpoints require both a valid JWT and the admin role.
// Get all appointments (admin only)
router.get(
    "/admin/all-appointments",
    verifyToken,
    verifyAdmin,
    appointmentController.getAllAppointments
);

// Update appointment status (admin only)
router.put(
    "/admin/update-status",
    verifyToken,
    verifyAdmin,
    appointmentController.updateAppointmentStatus
);

module.exports = router;