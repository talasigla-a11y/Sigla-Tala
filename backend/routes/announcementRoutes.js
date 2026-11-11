const express = require("express");
const router = express.Router();
const announcementController = require("../controllers/announcementController");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");

router.get("/", announcementController.getAnnouncements);
router.post("/", verifyToken, verifyAdmin, announcementController.createAnnouncement);
router.delete("/:id", verifyToken, verifyAdmin, announcementController.deleteAnnouncement);

module.exports = router;
