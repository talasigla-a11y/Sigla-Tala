const express = require("express");
const router = express.Router();
const announcementController = require("../controllers/announcementController");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");
const multer = require("multer");

const uploadPoster = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error("Poster must be a JPG, PNG, or WEBP image."));
        }
        callback(null, true);
    }
});

const handlePosterUpload = (req, res, next) => {
    uploadPoster.single("poster")(req, res, (err) => {
        if (!err) return next();
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({
            success: false,
            message: err.code === "LIMIT_FILE_SIZE"
                ? "Poster must be no larger than 5 MB."
                : err.message
        });
    });
};

router.get("/", announcementController.getAnnouncements);
router.get("/:id/poster", announcementController.getAnnouncementPoster);
router.post("/", verifyToken, verifyAdmin, handlePosterUpload, announcementController.createAnnouncement);
router.delete("/:id", verifyToken, verifyAdmin, announcementController.deleteAnnouncement);

module.exports = router;
