const db = require("../database/db");

// Adds optional attachment columns for databases created before file uploads existed.
const addFileColumns = (callback) => {
    db.query("ALTER TABLE appointments ADD COLUMN file_name VARCHAR(255) NULL, ADD COLUMN file_data MEDIUMBLOB NULL", (err) => {
        if (err && err.code !== "ER_DUP_FIELDNAME") return callback(err);
        callback(null);
    });
};

// Adds an optional reason for appointments booked under the "Other" type.
const ensureOtherReasonColumn = (callback) => {
    db.query("ALTER TABLE appointments ADD COLUMN other_reason VARCHAR(500) NULL", (err) => {
        if (err && err.code !== "ER_DUP_FIELDNAME") return callback(err);
        callback(null);
    });
};

// Stores which worker accepted an appointment, separately from its initial assignment.
const ensureAcceptedByWorkerColumn = (callback) => {
    const addColumns = [
        "ALTER TABLE appointments ADD COLUMN accepted_by_worker_id INT NULL",
        "ALTER TABLE appointments ADD COLUMN receipt_token_hash CHAR(64) NULL",
        "ALTER TABLE appointments ADD COLUMN receipt_email_sent_at DATETIME NULL"
    ];

    const addNextColumn = (index) => {
        if (index === addColumns.length) {
            const backfillSql = `
                UPDATE appointments
                SET accepted_by_worker_id = assigned_admin_id
                WHERE status = 'Accepted'
                  AND accepted_by_worker_id IS NULL
                  AND assigned_admin_id IS NOT NULL
            `;

            db.query(backfillSql, callback);
            return;
        }

        db.query(addColumns[index], (err) => {
            if (err && err.code !== "ER_DUP_FIELDNAME") return callback(err);
            addNextColumn(index + 1);
        });
    };

    addNextColumn(0);
};

// Creates a separate attachment row for each uploaded appointment file.
const ensureAttachmentTable = (callback) => {
    const sql = `
        CREATE TABLE IF NOT EXISTS appointment_attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            appointment_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_data MEDIUMBLOB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_appointment_attachments_appointment_id (appointment_id)
        )
    `;

    db.query(sql, (createErr) => {
        if (createErr) return callback(createErr);

        const migrateSql = `
            INSERT INTO appointment_attachments (appointment_id, file_name, file_data)
            SELECT a.id, a.file_name, a.file_data
            FROM appointments a
            WHERE a.file_name IS NOT NULL
              AND a.file_data IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM appointment_attachments aa
                  WHERE aa.appointment_id = a.id
                    AND aa.file_name = a.file_name
              )
        `;

        db.query(migrateSql, callback);
    });
};

// Adds assignment columns and links existing appointments to configured workers.
const ensureJobSpecificationColumn = (callback) => {
    db.query("ALTER TABLE appointments ADD COLUMN job_specification VARCHAR(100) NULL", (alterErr) => {
        if (alterErr && alterErr.code !== "ER_DUP_FIELDNAME") return callback(alterErr);

        db.query("ALTER TABLE appointments ADD COLUMN assigned_admin_id INT NULL", (assignedAdminErr) => {
            if (assignedAdminErr && assignedAdminErr.code !== "ER_DUP_FIELDNAME") return callback(assignedAdminErr);

            const backfillSql = `
            UPDATE appointments
            SET job_specification = CASE LOWER(TRIM(appointment_type))
                WHEN 'general consultation' THEN 'General Practitioner'
                WHEN 'checkup' THEN 'General Practitioner'
                WHEN 'check-up' THEN 'General Practitioner'
                WHEN 'prenatal check-up' THEN 'General Practitioner'
                WHEN 'dental' THEN 'Dentist'
                WHEN 'vaccination' THEN 'Vaccinator'
                WHEN 'pediatric consultation' THEN 'Pediatrician'
                ELSE 'Health Care workers'
            END
        `;

            db.query(backfillSql, (backfillErr) => {
                if (backfillErr) return callback(backfillErr);

                                const assignmentSql = `
                                        UPDATE appointments a
                                        SET a.assigned_admin_id = (
                                                SELECT u.id
                                                FROM users u
                                                WHERE LOWER(TRIM(u.role)) IN ('worker', 'admin')
                                                    AND LOWER(TRIM(u.job_specification)) = LOWER(TRIM(a.job_specification))
                                                ORDER BY u.id
                                                LIMIT 1
                                        )
                                        WHERE a.assigned_admin_id IS NULL
                                            AND EXISTS (
                                                SELECT 1
                                                FROM users u
                                                WHERE LOWER(TRIM(u.role)) IN ('worker', 'admin')
                                                    AND LOWER(TRIM(u.job_specification)) = LOWER(TRIM(a.job_specification))
                                        )
                `;

                db.query(assignmentSql, callback);
            });
        });
    });
};

// Finds the first worker configured for an appointment specialty.
const getAdminByJobSpecification = (jobSpecification, callback) => {
    const sql = `
        SELECT id, fullname, job_specification
        FROM users
        WHERE LOWER(TRIM(role)) IN ('worker','admin')
          AND LOWER(TRIM(job_specification)) = LOWER(TRIM(?))
        ORDER BY id
        LIMIT 1
    `;

    db.query(sql, [jobSpecification], callback);
};

// Assigns existing unassigned appointments to the first worker for a specialty.
const assignUnassignedAppointmentsByJobSpecification = (jobSpecification, callback) => {
    const sql = `
        UPDATE appointments
                SET assigned_admin_id = (
                        SELECT id
                        FROM users
                        WHERE LOWER(TRIM(role)) IN ('worker','admin')
                            AND LOWER(TRIM(job_specification)) = LOWER(TRIM(?))
                        ORDER BY id
                        LIMIT 1
                )
        WHERE assigned_admin_id IS NULL
          AND LOWER(TRIM(job_specification)) = LOWER(TRIM(?))
    `;

        db.query(sql, [jobSpecification, jobSpecification], callback);
};

// Checks whether a given date and half-hour slot is already booked.
const getAppointmentByDateAndTime = (appointmentDate, timePreference, callback) => {
    const sql = `
        SELECT id, user_id, appointment_date, time_preference
        FROM appointments
        WHERE appointment_date = ?
          AND time_preference = ?
        LIMIT 1
    `;

    db.query(sql, [appointmentDate, timePreference], callback);
};

// ================= CREATE APPOINTMENT =================
// Inserts an appointment and all uploaded files as one transaction.
const createAppointment = (appointment, callback) => {
    const sql = `
        INSERT INTO appointments
        (
            user_id,
            appointment_type,
            job_specification,
            assigned_admin_id,
            appointment_date,
            time_preference,
            other_reason,
            status,
            file_name,
            file_data
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
    `;

    const attachments = appointment.attachments || [];

    db.beginTransaction((transactionErr) => {
        if (transactionErr) return callback(transactionErr);

        db.query(
            sql,
            [
                appointment.user_id,
                appointment.appointment_type,
                appointment.job_specification,
                appointment.assigned_admin_id,
                appointment.appointment_date,
                appointment.time_preference,
                appointment.other_reason || null,
                attachments[0] ? attachments[0].file_name : null,
                attachments[0] ? attachments[0].file_data : null
            ],
            (insertErr, result) => {
                if (insertErr) {
                    return db.rollback(() => callback(insertErr));
                }

                if (attachments.length === 0) {
                    return db.commit((commitErr) => {
                        if (commitErr) return db.rollback(() => callback(commitErr));
                        callback(null, result);
                    });
                }

                const attachmentValues = attachments.map((attachment) => [
                    result.insertId,
                    attachment.file_name,
                    attachment.file_data
                ]);
                const attachmentSql = `
                    INSERT INTO appointment_attachments
                        (appointment_id, file_name, file_data)
                    VALUES ?
                `;

                db.query(attachmentSql, [attachmentValues], (attachmentErr) => {
                    if (attachmentErr) {
                        return db.rollback(() => callback(attachmentErr));
                    }

                    db.commit((commitErr) => {
                        if (commitErr) return db.rollback(() => callback(commitErr));
                        callback(null, result);
                    });
                });
            }
        );
    });
};

// Adds attachment names to appointment records without returning binary file data.
const addAttachmentNames = (appointments, callback) => {
    if (!appointments.length) {
        return callback(null, appointments);
    }

    const ids = appointments.map((appointment) => appointment.id);
    const placeholders = ids.map(() => "?").join(", ");
    const sql = `
        SELECT appointment_id, id, file_name
        FROM appointment_attachments
        WHERE appointment_id IN (${placeholders})
        ORDER BY id
    `;

    db.query(sql, ids, (err, rows) => {
        if (err) return callback(err);

        const attachmentsByAppointment = new Map();
        rows.forEach((row) => {
            if (!attachmentsByAppointment.has(row.appointment_id)) {
                attachmentsByAppointment.set(row.appointment_id, []);
            }

            attachmentsByAppointment.get(row.appointment_id).push({
                id: row.id,
                file_name: row.file_name
            });
        });

        appointments.forEach((appointment) => {
            appointment.attachments =
                attachmentsByAppointment.get(appointment.id) || [];

            if (!appointment.attachments.length && appointment.file_name) {
                appointment.attachments.push({
                    id: null,
                    file_name: appointment.file_name
                });
            }
        });

        callback(null, appointments);
    });
};


// ================= GET USER APPOINTMENTS =================
// Queries appointments belonging to one patient.
const getAppointmentsByUserId = (userId, callback) => {
    const sql = `
        SELECT
            a.id,
            a.user_id,
            a.appointment_type,
            a.job_specification,
            a.assigned_admin_id,
            a.appointment_date,
            a.time_preference,
            a.other_reason,
            accepted_by.fullname AS accepted_by_name,
            a.receipt_email_sent_at,
            a.status,
            a.file_name,
            a.created_at,
            u.fullname AS assigned_admin_name
        FROM appointments a
        LEFT JOIN users u ON u.id = a.assigned_admin_id
        LEFT JOIN users accepted_by ON accepted_by.id = a.accepted_by_worker_id
        WHERE a.user_id = ?
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) return callback(err);
        addAttachmentNames(results, callback);
    });
};


// ================= GET ALL APPOINTMENTS (ADMIN) =================
// Joins appointments with patient details for the admin dashboard.
const getAllAppointments = (adminId, callback) => {
    const sql = `
        SELECT 
            a.id,
            a.user_id,
            a.appointment_type,
            a.job_specification,
            a.assigned_admin_id,
            a.appointment_date,
            a.time_preference,
            a.other_reason,
            accepted_by.fullname AS acceptedByName,
            a.receipt_email_sent_at AS receiptEmailSentAt,
            (a.receipt_email_sent_at IS NOT NULL) AS receiptEmailSent,
            a.status,
            a.file_name,
            a.created_at,
            patient.fullname as patientName,
            patient.email as patientEmail,
            administrator.fullname as assignedAdminName
        FROM appointments a
        LEFT JOIN users patient ON a.user_id = patient.id
        LEFT JOIN users administrator ON a.assigned_admin_id = administrator.id
        LEFT JOIN users accepted_by ON accepted_by.id = a.accepted_by_worker_id
        WHERE a.assigned_admin_id = ?
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `;

    db.query(sql, [adminId], (err, results) => {
        if (err) return callback(err);
        addAttachmentNames(results, callback);
    });
};

// Marks an appointment accepted and returns the private data required to email its receipt.
const prepareAcceptedAppointmentReceipt = (appointmentId, workerId, tokenHash, callback) => {
    const updateSql = `
        UPDATE appointments
        SET status = 'Accepted',
            accepted_by_worker_id = ?,
            receipt_token_hash = ?,
            receipt_email_sent_at = NULL
        WHERE id = ?
          AND assigned_admin_id = ?
          AND (
              status = 'Pending'
              OR (
                  status = 'Accepted'
                  AND accepted_by_worker_id = ?
                  AND receipt_email_sent_at IS NULL
              )
          )
    `;

    db.query(updateSql, [workerId, tokenHash, appointmentId, workerId, workerId], (updateErr, result) => {
        if (updateErr) return callback(updateErr);
        if (!result.affectedRows) return callback(null, null);

        const receiptSql = `
            SELECT
                a.id,
                a.appointment_type,
                a.appointment_date,
                a.time_preference,
                a.other_reason,
                a.job_specification,
                a.receipt_token_hash,
                patient.fullname AS patient_name,
                patient.email AS patient_email,
                worker.fullname AS accepted_by_name
            FROM appointments a
            JOIN users patient ON patient.id = a.user_id
            JOIN users worker ON worker.id = a.accepted_by_worker_id
            WHERE a.id = ?
              AND a.status = 'Accepted'
              AND a.accepted_by_worker_id = ?
        `;

        db.query(receiptSql, [appointmentId, workerId], (receiptErr, rows) => {
            if (receiptErr) return callback(receiptErr);
            callback(null, rows[0] || null);
        });
    });
};

// Verifies an emailed receipt token and returns only its matching accepted appointment.
const getAppointmentReceiptByToken = (appointmentId, tokenHash, callback) => {
    const sql = `
        SELECT
            a.id,
            a.appointment_type,
            a.appointment_date,
            a.time_preference,
            a.other_reason,
            a.job_specification,
            a.status,
            patient.fullname AS patient_name,
            worker.fullname AS accepted_by_name
        FROM appointments a
        JOIN users patient ON patient.id = a.user_id
        LEFT JOIN users worker ON worker.id = a.accepted_by_worker_id
        WHERE a.id = ?
          AND a.status = 'Accepted'
          AND a.receipt_token_hash = ?
    `;

    db.query(sql, [appointmentId, tokenHash], (err, rows) => {
        if (err) return callback(err);
        callback(null, rows[0] || null);
    });
};

// Marks delivery only for the currently issued appointment receipt token.
const markReceiptEmailSent = (appointmentId, tokenHash, callback) => {
    const sql = `
        UPDATE appointments
        SET receipt_email_sent_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'Accepted'
          AND receipt_token_hash = ?
    `;

    db.query(sql, [appointmentId, tokenHash], callback);
};


// ================= UPDATE APPOINTMENT STATUS =================
// Persists the admin's status decision for an appointment.
const updateAppointmentStatus = (appointmentId, status, adminId, callback) => {
    const sql = `
        UPDATE appointments
        SET status = ?,
            accepted_by_worker_id = CASE WHEN ? = 'Accepted' THEN ? ELSE NULL END,
            receipt_token_hash = CASE WHEN ? = 'Accepted' THEN receipt_token_hash ELSE NULL END,
            receipt_email_sent_at = CASE WHEN ? = 'Accepted' THEN receipt_email_sent_at ELSE NULL END
        WHERE id = ? AND assigned_admin_id = ?
    `;

    db.query(
        sql,
        [status, status, adminId, status, status, appointmentId, adminId],
        callback
    );
};


module.exports = {
    addFileColumns,
    ensureOtherReasonColumn,
    ensureAcceptedByWorkerColumn,
    ensureAttachmentTable,
    ensureJobSpecificationColumn,
    getAdminByJobSpecification,
    assignUnassignedAppointmentsByJobSpecification,
    getAppointmentByDateAndTime,
    createAppointment,
    getAppointmentsByUserId,
    getAllAppointments,
    prepareAcceptedAppointmentReceipt,
    getAppointmentReceiptByToken,
    markReceiptEmailSent,
    updateAppointmentStatus
};