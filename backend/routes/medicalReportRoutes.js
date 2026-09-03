const express = require("express");
const router = express.Router();
const controller = require("../controllers/medicalReportController");

router.get("/pending", controller.getPendingReports);
router.get("/", controller.getReports);
router.post("/", controller.createReport);

module.exports = router;
