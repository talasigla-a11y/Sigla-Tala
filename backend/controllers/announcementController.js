const announcementModel = require("../models/announcementModel");
const leadAdminModel = require("../models/leadAdminModel");

const getAnnouncements = (req, res) => {
    announcementModel.getAllAnnouncements((err, results) => {
        if (err) {
            console.error("GET ANNOUNCEMENTS ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to load announcements."
            });
        }

        return res.status(200).json({
            success: true,
            announcements: results
        });
    });
};

const createAnnouncement = (req, res) => {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();

    if (!title || !content) {
        return res.status(400).json({
            success: false,
            message: "Title and content are required."
        });
    }

    announcementModel.createAnnouncement(title, content, (err, result) => {
        if (err) {
            console.error("CREATE ANNOUNCEMENT ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to create announcement."
            });
        }

        leadAdminModel.logActivity(
            req.user.id,
            "announcement_created",
            "announcement",
            result.insertId,
            "Center announcement posted",
            (logErr) => {
                if (logErr) console.error("ANNOUNCEMENT ACTIVITY LOG ERROR:", logErr);
            }
        );

        return res.status(201).json({
            success: true,
            announcement: {
                id: result.insertId,
                title,
                content
            }
        });
    });
};

const deleteAnnouncement = (req, res) => {
    announcementModel.deleteAnnouncement(req.params.id, (err, result) => {
        if (err) {
            console.error("DELETE ANNOUNCEMENT ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to delete announcement."
            });
        }

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found."
            });
        }

        leadAdminModel.logActivity(
            req.user.id,
            "announcement_deleted",
            "announcement",
            Number(req.params.id),
            "Center announcement deleted",
            (logErr) => {
                if (logErr) console.error("ANNOUNCEMENT ACTIVITY LOG ERROR:", logErr);
            }
        );

        return res.status(200).json({ success: true });
    });
};

module.exports = {
    getAnnouncements,
    createAnnouncement,
    deleteAnnouncement
};
