const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

// Public authentication flow: registration, login, OTP verification, and password recovery.
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-otp", authController.verifyOTP);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/verify-login-otp", authController.verifyLoginOTP);
// Profile endpoints require a valid JWT because they access private user data.
router.put("/profile", verifyToken, authController.updateProfile);
router.get("/profile", verifyToken, authController.getProfile);

module.exports = router;