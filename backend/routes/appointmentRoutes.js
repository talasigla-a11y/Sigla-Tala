const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointmentController");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");
const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
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

router.post(
    "/receipt/verify",
    appointmentController.verifyAppointmentReceipt
);

router.post(
    "/",
    verifyToken,
    upload.array("attachments", 5),
    appointmentController.createAppointment
);

router.get(
    "/provider",
    verifyToken,
    appointmentController.getProviderForAppointmentType
);

router.get(
    "/scheduled-workers",
    verifyToken,
    appointmentController.getScheduledWorkersForDate
);

router.get(
    "/my-appointments",
    verifyToken,
    appointmentController.getMyAppointments
);

router.get(
    "/admin/all-appointments",
    verifyToken,
    verifyAdmin,
    appointmentController.getAllAppointments
);

router.put(
    "/admin/update-status",
    verifyToken,
    verifyAdmin,
    appointmentController.updateAppointmentStatus
);

module.exports = router;