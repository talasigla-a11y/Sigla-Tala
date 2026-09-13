const express = require("express");
const router = express.Router();
const announcementController = require("../controllers/announcementController");

// Maps HTTP announcement requests to the corresponding controller functions.
router.get("/", announcementController.getAnnouncements);
router.post("/", announcementController.createAnnouncement);
router.delete("/:id", announcementController.deleteAnnouncement);

module.exports = router;
