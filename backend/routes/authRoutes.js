const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-otp", authController.verifyOTP);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/verify-login-otp", authController.verifyLoginOTP);
router.put("/profile", verifyToken, authController.updateProfile);
router.get("/profile", verifyToken, authController.getProfile);

module.exports = router;