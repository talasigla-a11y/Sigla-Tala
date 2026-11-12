const announcementModel = require("../models/announcementModel");
const leadAdminModel = require("../models/leadAdminModel");

const getPosterMimeType = (buffer) => {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    return null;
};

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

const getAnnouncementPoster = (req, res) => {
    const announcementId = Number(req.params.id);
    if (!Number.isSafeInteger(announcementId) || announcementId < 1) {
        return res.status(400).json({ success: false, message: "A valid announcement is required." });
    }

    announcementModel.getAnnouncementPoster(announcementId, (err, results) => {
        if (err) {
            console.error("GET ANNOUNCEMENT POSTER ERROR:", err);
            return res.status(500).json({ success: false, message: "Failed to load announcement poster." });
        }
        if (!results.length) return res.status(404).json({ success: false, message: "Announcement poster not found." });

        const poster = results[0];
        res.set("Content-Type", poster.poster_mime_type);
        res.set("X-Content-Type-Options", "nosniff");
        res.set("Cache-Control", "public, max-age=3600");
        return res.send(poster.poster_data);
    });
};

const createAnnouncement = (req, res) => {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const uploadedPoster = req.file;

    if (!title || (!content && !uploadedPoster)) {
        return res.status(400).json({
            success: false,
            message: "A title and either announcement text or a poster are required."
        });
    }

    let poster = null;
    if (uploadedPoster) {
        const mimeType = getPosterMimeType(uploadedPoster.buffer);
        if (!mimeType || mimeType !== uploadedPoster.mimetype) {
            return res.status(400).json({ success: false, message: "The uploaded poster is not a valid JPG, PNG, or WEBP image." });
        }
        poster = {
            data: uploadedPoster.buffer,
            mimeType,
            fileName: uploadedPoster.originalname.slice(0, 255)
        };
    }

    announcementModel.createAnnouncement(title, content, poster, (err, result) => {
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
                content,
                has_poster: Boolean(poster)
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
    getAnnouncementPoster,
    createAnnouncement,
    deleteAnnouncement
};
