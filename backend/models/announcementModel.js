const db = require("../database/db");

const createTable = (callback) => {
    const sql = `
        CREATE TABLE IF NOT EXISTS announcements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            poster_data MEDIUMBLOB NULL,
            poster_mime_type VARCHAR(50) NULL,
            poster_file_name VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    db.query(sql, (createErr) => {
        if (createErr) return callback(createErr);
        db.query("SHOW COLUMNS FROM announcements", (columnsErr, columns) => {
            if (columnsErr) return callback(columnsErr);
            const existingColumns = new Set(columns.map((column) => column.Field));
            const migrations = [
                ["poster_data", "MEDIUMBLOB NULL"],
                ["poster_mime_type", "VARCHAR(50) NULL"],
                ["poster_file_name", "VARCHAR(255) NULL"]
            ].filter(([name]) => !existingColumns.has(name));

            const addNextColumn = (index) => {
                if (index >= migrations.length) return callback(null);
                const [name, definition] = migrations[index];
                db.query(`ALTER TABLE announcements ADD COLUMN ${name} ${definition}`, (alterErr) => {
                    if (alterErr) return callback(alterErr);
                    addNextColumn(index + 1);
                });
            };

            addNextColumn(0);
        });
    });
};

const getAllAnnouncements = (callback) => {
    const sql = `
        SELECT id, title, content, created_at, poster_mime_type,
               (poster_data IS NOT NULL) AS has_poster
        FROM announcements
        ORDER BY created_at DESC, id DESC
    `;

    db.query(sql, callback);
};

const getAnnouncementPoster = (announcementId, callback) => {
    db.query(
        "SELECT poster_data, poster_mime_type FROM announcements WHERE id = ? AND poster_data IS NOT NULL",
        [announcementId],
        callback
    );
};

const createAnnouncement = (title, content, poster, callback) => {
    const sql = `
        INSERT INTO announcements (title, content, poster_data, poster_mime_type, poster_file_name)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        title,
        content,
        poster ? poster.data : null,
        poster ? poster.mimeType : null,
        poster ? poster.fileName : null
    ], callback);
};

const deleteAnnouncement = (announcementId, callback) => {
    const sql = `DELETE FROM announcements WHERE id = ?`;

    db.query(sql, [announcementId], callback);
};

module.exports = {
    createTable,
    getAllAnnouncements,
    getAnnouncementPoster,
    createAnnouncement,
    deleteAnnouncement
};
