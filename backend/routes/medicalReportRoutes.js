const express = require("express");
const router = express.Router();
const controller = require("../controllers/medicalReportController");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");

// Medical reports are restricted to authenticated workers.
router.get("/pending", verifyToken, verifyAdmin, controller.getPendingReports);
router.get("/", verifyToken, verifyAdmin, controller.getReports);
router.post("/", verifyToken, verifyAdmin, controller.createReport);

module.exports = router;
