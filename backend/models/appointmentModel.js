const db = require("../database/db");

// Adds optional attachment columns for databases created before file uploads existed.
const addFileColumns = (callback) => {
    db.query("ALTER TABLE appointments ADD COLUMN file_name VARCHAR(255) NULL, ADD COLUMN file_data MEDIUMBLOB NULL", (err) => {
        if (err && err.code !== "ER_DUP_FIELDNAME") return callback(err);
        callback(null);
    });
};

// Adds assignment columns and links existing appointments to configured admins.
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
                                                WHERE LOWER(TRIM(u.role)) = 'admin'
                                                    AND LOWER(TRIM(u.job_specification)) = LOWER(TRIM(a.job_specification))
                                                ORDER BY u.id
                                                LIMIT 1
                                        )
                                        WHERE a.assigned_admin_id IS NULL
                                            AND EXISTS (
                                                SELECT 1
                                                FROM users u
                                                WHERE LOWER(TRIM(u.role)) = 'admin'
                                                    AND LOWER(TRIM(u.job_specification)) = LOWER(TRIM(a.job_specification))
                                        )
                `;

                db.query(assignmentSql, callback);
            });
        });
    });
};

// Finds the first administrator configured for an appointment specialty.
const getAdminByJobSpecification = (jobSpecification, callback) => {
    const sql = `
        SELECT id, fullname, job_specification
        FROM users
        WHERE LOWER(TRIM(role)) = 'admin'
          AND LOWER(TRIM(job_specification)) = LOWER(TRIM(?))
        ORDER BY id
        LIMIT 1
    `;

    db.query(sql, [jobSpecification], callback);
};

// Assigns existing unassigned appointments to the first admin for a specialty.
const assignUnassignedAppointmentsByJobSpecification = (jobSpecification, callback) => {
    const sql = `
        UPDATE appointments
                SET assigned_admin_id = (
                        SELECT id
                        FROM users
                        WHERE LOWER(TRIM(role)) = 'admin'
                            AND LOWER(TRIM(job_specification)) = LOWER(TRIM(?))
                        ORDER BY id
                        LIMIT 1
                )
        WHERE assigned_admin_id IS NULL
          AND LOWER(TRIM(job_specification)) = LOWER(TRIM(?))
    `;

        db.query(sql, [jobSpecification, jobSpecification], callback);
};

// ================= CREATE APPOINTMENT =================
// Inserts an appointment and stores an optional uploaded file in the database.
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
            status,
            file_name,
            file_data
        )
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
    `;

    db.query(
        sql,
        [
            appointment.user_id,
            appointment.appointment_type,
            appointment.job_specification,
            appointment.assigned_admin_id,
            appointment.appointment_date,
            appointment.time_preference,
            appointment.file_name || null,
            appointment.file_data || null
        ],
        callback
    );
};


// ================= GET USER APPOINTMENTS =================
// Queries appointments belonging to one patient.
const getAppointmentsByUserId = (userId, callback) => {
    const sql = `
        SELECT a.*, u.fullname AS assigned_admin_name
        FROM appointments a
        LEFT JOIN users u ON u.id = a.assigned_admin_id
        WHERE a.user_id = ?
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `;

    db.query(sql, [userId], callback);
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
            a.status,
            a.file_name,
            a.created_at,
            patient.fullname as patientName,
            patient.email as patientEmail,
            administrator.fullname as assignedAdminName
        FROM appointments a
        LEFT JOIN users patient ON a.user_id = patient.id
        LEFT JOIN users administrator ON a.assigned_admin_id = administrator.id
        WHERE a.assigned_admin_id = ?
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `;

    db.query(sql, [adminId], callback);
};


// ================= UPDATE APPOINTMENT STATUS =================
// Persists the admin's status decision for an appointment.
const updateAppointmentStatus = (appointmentId, status, adminId, callback) => {
    const sql = `
        UPDATE appointments
        SET status = ?
        WHERE id = ? AND assigned_admin_id = ?
    `;

    db.query(sql, [status, appointmentId, adminId], callback);
};


module.exports = {
    addFileColumns,
    ensureJobSpecificationColumn,
    getAdminByJobSpecification,
    assignUnassignedAppointmentsByJobSpecification,
    createAppointment,
    getAppointmentsByUserId,
    getAllAppointments,
    updateAppointmentStatus
};