const express = require("express");
const router = express.Router();
const controller = require("../controllers/medicalReportController");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");

// Medical reports are restricted to authenticated workers.
router.get("/pending", verifyToken, verifyAdmin, controller.getPendingReports);
router.get("/", verifyToken, verifyAdmin, controller.getReports);
router.get("/appointments/:appointmentId/attachments/:attachmentId", verifyToken, verifyAdmin, controller.getAttachment);
router.post("/", verifyToken, verifyAdmin, controller.createReport);
router.post("/:reportId/resend", verifyToken, verifyAdmin, controller.resendReport);

module.exports = router;
