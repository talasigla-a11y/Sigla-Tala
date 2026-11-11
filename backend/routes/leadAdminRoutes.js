const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const verifyLeadAdmin = require("../middleware/leadAdminMiddleware");
const controller = require("../controllers/leadAdminController");

router.use(verifyToken, verifyLeadAdmin);
router.get("/report", controller.getReport);
router.get("/appointments/:appointmentId", controller.getAppointmentDetails);
router.get("/workers", controller.getWorkers);
router.put("/appointments/assign", controller.assignAppointment);
router.get("/schedules", controller.getSchedules);
router.post("/schedules", controller.saveSchedule);
router.put("/schedules", controller.saveSchedule);
router.delete("/schedules/:scheduleId", controller.deleteSchedule);
router.put("/schedules/:scheduleId/attendance", controller.updateScheduleAttendance);
router.get("/activity-logs", controller.getActivityLogs);

module.exports = router;
