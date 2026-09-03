const db = require("../database/db");

const addFileColumns = (callback) => {
    db.query("ALTER TABLE appointments ADD COLUMN file_name VARCHAR(255) NULL, ADD COLUMN file_data MEDIUMBLOB NULL", (err) => {
        if (err && err.code !== "ER_DUP_FIELDNAME") return callback(err);
        callback(null);
    });
};

// ================= CREATE APPOINTMENT =================
const createAppointment = (appointment, callback) => {
    const sql = `
        INSERT INTO appointments
        (
            user_id,
            appointment_type,
            appointment_date,
            time_preference,
            status,
            file_name,
            file_data
        )
        VALUES (?, ?, ?, ?, 'Pending', ?, ?)
    `;

    db.query(
        sql,
        [
            appointment.user_id,
            appointment.appointment_type,
            appointment.appointment_date,
            appointment.time_preference,
            appointment.file_name || null,
            appointment.file_data || null
        ],
        callback
    );
};


// ================= GET USER APPOINTMENTS =================
const getAppointmentsByUserId = (userId, callback) => {
    const sql = `
        SELECT *
        FROM appointments
        WHERE user_id = ?
        ORDER BY appointment_date DESC, created_at DESC
    `;

    db.query(sql, [userId], callback);
};


// ================= GET ALL APPOINTMENTS (ADMIN) =================
const getAllAppointments = (callback) => {
    const sql = `
        SELECT 
            a.id,
            a.user_id,
            a.appointment_type,
            a.appointment_date,
            a.time_preference,
            a.status,
            a.file_name,
            a.created_at,
            u.fullname as patientName,
            u.email as patientEmail
        FROM appointments a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `;

    db.query(sql, callback);
};


// ================= UPDATE APPOINTMENT STATUS =================
const updateAppointmentStatus = (appointmentId, status, callback) => {
    const sql = `
        UPDATE appointments
        SET status = ?
        WHERE id = ?
    `;

    db.query(sql, [status, appointmentId], callback);
};


module.exports = {
    addFileColumns,
    createAppointment,
    getAppointmentsByUserId,
    getAllAppointments,
    updateAppointmentStatus
};