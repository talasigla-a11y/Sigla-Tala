const leadAdminModel = require("../models/leadAdminModel");

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const getDateRange = (req) => {
    const today = new Date().toISOString().slice(0, 10);
    const from = String(req.query.from || today);
    const to = String(req.query.to || from);
    return validDate(from) && validDate(to) && from <= to ? { from, to } : null;
};

const getReport = (req, res) => {
    const range = getDateRange(req);
    if (!range) return res.status(400).json({ success: false, message: "Provide a valid date range." });
    leadAdminModel.getReport(range.from, range.to, (err, report) => {
        if (err) {
            console.error("LEAD ADMIN REPORT ERROR:", err);
            return res.status(500).json({ success: false, message: "Unable to load appointment reports." });
        }
        res.json({ success: true, ...report });
    });
};

const getWorkers = (req, res) => {
    leadAdminModel.getWorkers((err, workers) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to load workers." });
        res.json({ success: true, workers });
    });
};

const assignAppointment = (req, res) => {
    const appointmentId = Number(req.body.appointmentId);
    const workerId = Number(req.body.workerId);
    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1 || !Number.isSafeInteger(workerId) || workerId < 1) {
        return res.status(400).json({ success: false, message: "A valid appointment and worker are required." });
    }
    leadAdminModel.getWorkerById(workerId, (workerErr, workers) => {
        if (workerErr) return res.status(500).json({ success: false, message: "Unable to validate the worker." });
        if (!workers.length) return res.status(400).json({ success: false, message: "The selected account is not a worker." });
        leadAdminModel.assignAppointment(appointmentId, workerId, req.user.id, (err, updated) => {
            if (err) return res.status(500).json({ success: false, message: "Unable to assign the appointment." });
            if (!updated) return res.status(404).json({ success: false, message: "Appointment not found." });
            res.json({ success: true, message: "Appointment assigned successfully." });
        });
    });
};

const getSchedules = (req, res) => {
    const range = getDateRange(req);
    if (!range) return res.status(400).json({ success: false, message: "Provide a valid date range." });
    leadAdminModel.getSchedules(range.from, range.to, (err, schedules) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to load schedules." });
        res.json({ success: true, schedules });
    });
};

const saveSchedule = (req, res) => {
    const scheduleId = req.body.scheduleId ? Number(req.body.scheduleId) : null;
    const workerId = Number(req.body.workerId);
    const scheduleDate = String(req.body.scheduleDate || "");
    const startTime = String(req.body.startTime || "");
    const endTime = String(req.body.endTime || "");
    if ((scheduleId !== null && (!Number.isSafeInteger(scheduleId) || scheduleId < 1)) || !Number.isSafeInteger(workerId) || workerId < 1 || !validDate(scheduleDate) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime === endTime) {
        return res.status(400).json({ success: false, message: "Provide a valid worker, date, and time range. End time must differ from start time." });
    }
    leadAdminModel.getWorkerById(workerId, (workerErr, workers) => {
        if (workerErr) return res.status(500).json({ success: false, message: "Unable to validate the worker." });
        if (!workers.length) return res.status(400).json({ success: false, message: "The selected account is not a worker." });
        leadAdminModel.saveSchedule({ id: scheduleId, worker_id: workerId, schedule_date: scheduleDate, start_time: startTime, end_time: endTime, notes: String(req.body.notes || "").trim() }, req.user.id, (err) => {
            if (err && err.code === "SCHEDULE_CONFLICT") return res.status(409).json({ success: false, message: err.message });
            if (err) return res.status(500).json({ success: false, message: "Unable to save the schedule." });
            res.json({ success: true, message: "Worker schedule saved." });
        });
    });
};

const deleteSchedule = (req, res) => {
    const scheduleId = Number(req.params.scheduleId);
    if (!Number.isSafeInteger(scheduleId) || scheduleId < 1) {
        return res.status(400).json({ success: false, message: "A valid schedule is required." });
    }
    leadAdminModel.deleteSchedule(scheduleId, req.user.id, (err, deleted) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to delete the schedule." });
        if (!deleted) return res.status(404).json({ success: false, message: "Schedule not found." });
        res.json({ success: true, message: "Worker schedule deleted." });
    });
};

const getActivityLogs = (req, res) => {
    const range = getDateRange(req);
    if (!range) return res.status(400).json({ success: false, message: "Provide a valid date range." });
    leadAdminModel.getActivityLogs(range.from, range.to, (err, logs) => {
        if (err) return res.status(500).json({ success: false, message: "Unable to load activity logs." });
        res.json({ success: true, logs });
    });
};

module.exports = { getReport, getWorkers, assignAppointment, getSchedules, saveSchedule, deleteSchedule, getActivityLogs };
