const db = require("../database/db");

// Creates the announcements table during server startup when it does not exist.
const createTable = (callback) => {
    const sql = `
        CREATE TABLE IF NOT EXISTS announcements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    db.query(sql, callback);
};

// Reads announcements in reverse chronological order for dashboard display.
const getAllAnnouncements = (callback) => {
    const sql = `
        SELECT id, title, content, created_at
        FROM announcements
        ORDER BY created_at DESC, id DESC
    `;

    db.query(sql, callback);
};

// Inserts one announcement using parameterized SQL values.
const createAnnouncement = (title, content, callback) => {
    const sql = `
        INSERT INTO announcements (title, content)
        VALUES (?, ?)
    `;

    db.query(sql, [title, content], callback);
};

// Deletes one announcement by its database identifier.
const deleteAnnouncement = (announcementId, callback) => {
    const sql = `DELETE FROM announcements WHERE id = ?`;

    db.query(sql, [announcementId], callback);
};

module.exports = {
    createTable,
    getAllAnnouncements,
    createAnnouncement,
    deleteAnnouncement
};
