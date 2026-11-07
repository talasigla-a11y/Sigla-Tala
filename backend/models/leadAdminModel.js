const db = require("../database/db");

const createTables = (callback) => {
    const scheduleSql = `
        CREATE TABLE IF NOT EXISTS worker_schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            worker_id INT NOT NULL,
            schedule_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            notes VARCHAR(500) NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_worker_schedule (worker_id, schedule_date),
            INDEX idx_schedule_date (schedule_date)
        )
    `;
    const activitySql = `
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            actor_id INT NULL,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id INT NULL,
            details VARCHAR(1000) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_activity_created_at (created_at),
            INDEX idx_activity_actor (actor_id)
        )
    `;

    db.query(scheduleSql, (scheduleErr) => {
        if (scheduleErr) return callback(scheduleErr);
        db.query(activitySql, callback);
    });
};

const getReport = (from, to, callback) => {
    const summarySql = `
        SELECT
            COUNT(*) AS total_appointments,
            COUNT(DISTINCT user_id) AS unique_patients,
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) AS accepted,
            SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
        FROM appointments
        WHERE appointment_date BETWEEN ? AND ?
    `;
    const dailySql = `
        SELECT appointment_date AS date, COUNT(*) AS total
        FROM appointments
        WHERE appointment_date BETWEEN ? AND ?
        GROUP BY appointment_date
        ORDER BY appointment_date
    `;
    const categorySql = `
        SELECT
            COALESCE(NULLIF(TRIM(appointment_type), ''), 'Unspecified') AS category,
            COUNT(*) AS total,
            COUNT(DISTINCT user_id) AS patients
        FROM appointments
        WHERE appointment_date BETWEEN ? AND ?
        GROUP BY appointment_type
        ORDER BY patients DESC, total DESC, category
    `;
    const appointmentsSql = `
        SELECT a.id, a.appointment_date AS date, a.time_preference, a.appointment_type AS category,
               a.status, p.fullname AS patient_name, w.fullname AS worker_name
        FROM appointments a
        LEFT JOIN users p ON p.id = a.user_id
        LEFT JOIN users w ON w.id = a.assigned_admin_id
        WHERE a.appointment_date BETWEEN ? AND ?
        ORDER BY a.appointment_date, a.time_preference, a.created_at
    `;

    db.query(summarySql, [from, to], (summaryErr, summaryRows) => {
        if (summaryErr) return callback(summaryErr);
        db.query(dailySql, [from, to], (dailyErr, dailyRows) => {
            if (dailyErr) return callback(dailyErr);
            db.query(categorySql, [from, to], (categoryErr, categoryRows) => {
                if (categoryErr) return callback(categoryErr);
                db.query(appointmentsSql, [from, to], (appointmentsErr, appointments) => {
                    if (appointmentsErr) return callback(appointmentsErr);
                    callback(null, {
                        summary: summaryRows[0],
                        daily: dailyRows,
                        categories: categoryRows,
                        appointments
                    });
                });
            });
        });
    });
};

const getWorkers = (callback) => {
    db.query(
        "SELECT id, fullname, email, job_specification FROM users WHERE LOWER(role) IN ('worker', 'admin') ORDER BY fullname",
        callback
    );
};

const getWorkerById = (workerId, callback) => {
    db.query(
        "SELECT id FROM users WHERE id = ? AND LOWER(role) IN ('worker', 'admin')",
        [workerId],
        callback
    );
};

const assignAppointment = (appointmentId, workerId, actorId, callback) => {
    const sql = `
        UPDATE appointments
        SET assigned_admin_id = ?
        WHERE id = ?
          AND EXISTS (
              SELECT 1 FROM users
              WHERE users.id = ? AND LOWER(users.role) IN ('worker', 'admin')
          )
    `;
    db.query(sql, [workerId, appointmentId, workerId], (err, result) => {
        if (err) return callback(err);
        if (!result.affectedRows) return callback(null, false);
        logActivity(actorId, "appointment_assigned", "appointment", appointmentId, `Assigned to worker ${workerId}`, (logErr) => {
            if (logErr) return callback(logErr);
            callback(null, true);
        });
    });
};

const getSchedules = (from, to, callback) => {
    const sql = `
        SELECT s.id, s.worker_id, s.schedule_date, s.start_time, s.end_time, s.notes,
               u.fullname AS worker_name, u.job_specification
        FROM worker_schedules s
        INNER JOIN users u ON u.id = s.worker_id
        WHERE s.schedule_date BETWEEN ? AND ?
        ORDER BY s.schedule_date, s.start_time, u.fullname
    `;
    db.query(sql, [from, to], callback);
};

const saveSchedule = (schedule, actorId, callback) => {
    const sql = `
        INSERT INTO worker_schedules
            (worker_id, schedule_date, start_time, end_time, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            start_time = VALUES(start_time),
            end_time = VALUES(end_time),
            notes = VALUES(notes),
            created_by = VALUES(created_by)
    `;
    db.query(sql, [
        schedule.worker_id,
        schedule.schedule_date,
        schedule.start_time,
        schedule.end_time,
        schedule.notes || null,
        actorId
    ], (err, result) => {
        if (err) return callback(err);
        logActivity(actorId, "schedule_saved", "worker_schedule", result.insertId || schedule.worker_id, `Schedule updated for ${schedule.schedule_date}`, (logErr) => {
            if (logErr) return callback(logErr);
            callback(null, result);
        });
    });
};

const logActivity = (actorId, action, entityType, entityId, details, callback) => {
    db.query(
        "INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)",
        [actorId || null, action, entityType, entityId || null, details || null],
        callback
    );
};

const getActivityLogs = (from, to, callback) => {
    const sql = `
        SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
               u.fullname AS actor_name, u.email AS actor_email
        FROM activity_logs l
        LEFT JOIN users u ON u.id = l.actor_id
        WHERE DATE(l.created_at) BETWEEN ? AND ?
        ORDER BY l.created_at DESC
        LIMIT 500
    `;
    db.query(sql, [from, to], callback);
};

module.exports = {
    createTables,
    getReport,
    getWorkers,
    getWorkerById,
    assignAppointment,
    getSchedules,
    saveSchedule,
    logActivity,
    getActivityLogs
};
