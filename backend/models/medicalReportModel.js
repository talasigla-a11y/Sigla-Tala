const db = require("../database/db");

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

const getPendingAppointments = (callback) => {
    const sql = `
        SELECT a.id AS appointment_id, a.user_id, a.appointment_date,
               a.time_preference, a.file_name, u.fullname AS patient_name,
               u.email AS patient_email
        FROM appointments a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN medical_reports r ON r.appointment_id = a.id
        WHERE a.status = 'Accepted' AND r.id IS NULL
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `;
    db.query(sql, callback);
};

const getAllReports = (callback) => {
    const sql = `
        SELECT r.*, u.fullname AS patient_name
        FROM medical_reports r
        JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC
    `;
    db.query(sql, callback);
};

const createReport = (report, callback) => {
    const sql = `
        INSERT INTO medical_reports
        (appointment_id, user_id, doctor_name, recorded_date, diagnostic, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [report.appointment_id, report.user_id, report.doctor_name, report.recorded_date, report.diagnostic, report.notes], callback);
};

module.exports = { createTable, getPendingAppointments, getAllReports, createReport };
