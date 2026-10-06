const db = require("../database/db");

// Creates the medical reports table during startup.
const createTable = (callback) => {
    const sql = `
        CREATE TABLE IF NOT EXISTS medical_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            appointment_id INT NOT NULL,
            user_id INT NOT NULL,
            doctor_name VARCHAR(100) NOT NULL,
            recorded_date DATE NOT NULL,
            diagnostic VARCHAR(255) NOT NULL,
            notes TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_appointment_report (appointment_id)
        )
    `;
    db.query(sql, callback);
};

const addReportAttachments = (records, workerId, callback) => {
    if (!records.length) return callback(null, records);

    const ids = records.map((record) => record.appointment_id);
    const placeholders = ids.map(() => "?").join(", ");
    const sql = `
        SELECT aa.id, aa.appointment_id, aa.file_name
        FROM appointment_attachments aa
        JOIN appointments a ON a.id = aa.appointment_id
        WHERE a.assigned_admin_id = ?
          AND aa.appointment_id IN (${placeholders})
        ORDER BY aa.id
    `;

    db.query(sql, [workerId, ...ids], (err, attachments) => {
        if (err) return callback(err);
        const byAppointment = new Map();
        attachments.forEach((attachment) => {
            if (!byAppointment.has(attachment.appointment_id)) byAppointment.set(attachment.appointment_id, []);
            byAppointment.get(attachment.appointment_id).push({
                id: attachment.id,
                file_name: attachment.file_name
            });
        });
        records.forEach((record) => {
            record.attachments = byAppointment.get(record.appointment_id) || [];
            if (!record.attachments.length && record.file_name) {
                record.attachments.push({ id: "legacy", file_name: record.file_name });
            }
        });
        callback(null, records);
    });
};

// Finds completed appointments that do not yet have a medical report.
const getPendingAppointments = (workerId, callback) => {
    const sql = `
        SELECT a.id AS appointment_id, a.user_id, a.appointment_date,
               a.time_preference,
               COALESCE(
                   (SELECT GROUP_CONCAT(aa.file_name ORDER BY aa.id SEPARATOR ', ')
                    FROM appointment_attachments aa
                    WHERE aa.appointment_id = a.id),
                   a.file_name
               ) AS file_name,
               u.fullname AS patient_name,
               u.email AS patient_email
        FROM appointments a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN medical_reports r ON r.appointment_id = a.id
        WHERE a.status = 'Accepted'
          AND a.assigned_admin_id = ?
          AND r.id IS NULL
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `;
    db.query(sql, [workerId], (err, appointments) => {
        if (err) return callback(err);
        addReportAttachments(appointments, workerId, callback);
    });
};

// Retrieves reports together with the related patient and appointment data.
const getAllReports = (workerId, callback) => {
    const sql = `
        SELECT r.*, a.id AS appointment_id, a.file_name, u.fullname AS patient_name
        FROM medical_reports r
        JOIN users u ON u.id = r.user_id
        JOIN appointments a ON a.id = r.appointment_id
        WHERE a.assigned_admin_id = ?
        ORDER BY r.created_at DESC
    `;
    db.query(sql, [workerId], (err, reports) => {
        if (err) return callback(err);
        addReportAttachments(reports, workerId, callback);
    });
};

// Loads an uploaded file only when its appointment belongs to the requesting worker.
const getAppointmentAttachment = (appointmentId, attachmentId, workerId, callback) => {
    if (attachmentId === "legacy") {
        const legacySql = `
            SELECT a.file_name, a.file_data
            FROM appointments a
            WHERE a.id = ?
              AND a.assigned_admin_id = ?
              AND a.file_name IS NOT NULL
              AND a.file_data IS NOT NULL
            LIMIT 1
        `;
        return db.query(legacySql, [appointmentId, workerId], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows[0] || null);
        });
    }

    const sql = `
        SELECT aa.file_name, aa.file_data
        FROM appointment_attachments aa
        JOIN appointments a ON a.id = aa.appointment_id
        WHERE aa.appointment_id = ?
          AND aa.id = ?
          AND a.assigned_admin_id = ?
        LIMIT 1
    `;
    db.query(sql, [appointmentId, attachmentId, workerId], (err, rows) => {
        if (err) return callback(err);
        callback(null, rows[0] || null);
    });
};

// Loads a saved report and patient email for a worker-authorized resend.
const getReportForWorker = (reportId, workerId, callback) => {
    const sql = `
        SELECT r.*, u.fullname AS patient_name, u.email AS patient_email
        FROM medical_reports r
        JOIN users u ON u.id = r.user_id
        JOIN appointments a ON a.id = r.appointment_id
        WHERE r.id = ?
          AND a.assigned_admin_id = ?
        LIMIT 1
    `;
    db.query(sql, [reportId, workerId], (err, rows) => {
        if (err) return callback(err);
        callback(null, rows[0] || null);
    });
};

// Saves a report and its optional accepted follow-up as one atomic operation.
const createReport = (report, worker, followUp, tokenHash, callback) => {
    db.beginTransaction((transactionErr) => {
        if (transactionErr) return callback(transactionErr);

        const rollback = (err) => db.rollback(() => callback(err));
        const appointmentSql = `
            SELECT a.job_specification, u.fullname AS patient_name, u.email AS patient_email
            FROM appointments a
            JOIN users u ON u.id = a.user_id
            WHERE a.id = ?
              AND a.user_id = ?
              AND a.assigned_admin_id = ?
              AND a.status = 'Accepted'
            FOR UPDATE
        `;

        db.query(appointmentSql, [report.appointment_id, report.user_id, worker.id], (appointmentErr, appointments) => {
            if (appointmentErr) return rollback(appointmentErr);
            if (!appointments.length) {
                const err = new Error("This accepted appointment is not assigned to your worker account.");
                err.code = "REPORT_APPOINTMENT_NOT_ASSIGNED";
                return rollback(err);
            }

            const source = appointments[0];
            const createReportRow = () => {
                const reportSql = `
                    INSERT INTO medical_reports
                    (appointment_id, user_id, doctor_name, recorded_date, diagnostic, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;

                db.query(
                    reportSql,
                    [report.appointment_id, report.user_id, worker.fullname, report.recorded_date, report.diagnostic, report.notes],
                    (reportErr, reportResult) => {
                        if (reportErr) return rollback(reportErr);
                        if (!followUp) {
                            return db.commit((commitErr) => {
                                if (commitErr) return rollback(commitErr);
                                callback(null, { reportId: reportResult.insertId });
                            });
                        }

                        const followUpSql = `
                            INSERT INTO appointments
                            (
                                user_id, appointment_type, job_specification, assigned_admin_id,
                                appointment_date, time_preference, other_reason, status,
                                accepted_by_worker_id, receipt_token_hash, receipt_email_sent_at,
                                follow_up_report_id, file_name, file_data
                            )
                            VALUES (?, 'Follow-up Check-up', ?, ?, ?, ?, ?, 'Accepted', ?, ?, NULL, ?, NULL, NULL)
                        `;
                        const followUpReason = `Follow-up after appointment ST-${String(report.appointment_id).padStart(8, "0")}`;

                        db.query(
                            followUpSql,
                            [
                                report.user_id,
                                source.job_specification,
                                worker.id,
                                followUp.date,
                                followUp.time,
                                followUpReason,
                                worker.id,
                                tokenHash,
                                reportResult.insertId
                            ],
                            (followUpErr, followUpResult) => {
                                if (followUpErr) return rollback(followUpErr);
                                db.commit((commitErr) => {
                                    if (commitErr) return rollback(commitErr);
                                    callback(null, {
                                        reportId: reportResult.insertId,
                                        followUpAppointmentId: followUpResult.insertId,
                                        followUpReceipt: {
                                            id: followUpResult.insertId,
                                            patient_name: source.patient_name,
                                            patient_email: source.patient_email,
                                            appointment_type: "Follow-up Check-up",
                                            appointment_date: followUp.date,
                                            time_preference: followUp.time,
                                            other_reason: followUpReason,
                                            accepted_by_name: worker.fullname,
                                            job_specification: source.job_specification,
                                            diagnostic: report.diagnostic,
                                            notes: report.notes
                                        }
                                    });
                                });
                            }
                        );
                    }
                );
            };

            if (!followUp) return createReportRow();

            const slotSql = `
                SELECT id
                FROM appointments
                WHERE appointment_date = ?
                  AND time_preference = ?
                  AND status NOT IN ('Rejected', 'Cancelled')
                LIMIT 1
                FOR UPDATE
            `;
            db.query(slotSql, [followUp.date, followUp.time], (slotErr, slots) => {
                if (slotErr) return rollback(slotErr);
                if (slots.length) {
                    const err = new Error("That follow-up date and time is already booked. Choose another slot.");
                    err.code = "FOLLOW_UP_SLOT_TAKEN";
                    return rollback(err);
                }
                createReportRow();
            });
        });
    });
};

module.exports = {
    createTable,
    getPendingAppointments,
    getAllReports,
    getAppointmentAttachment,
    getReportForWorker,
    createReport
};
