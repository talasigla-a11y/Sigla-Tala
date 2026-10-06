const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const appointmentModel = require("../models/appointmentModel");
const sendOTP = require("../utils/sendEmail");

const ADMIN_JOB_SPECIFICATIONS = [
    "General Practitioner",
    "Dentist",
    "Vaccinator",
    "Health Care workers",
    "Pediatrician"
];

// Normalizes user input before it is compared with or stored in the database.
const sanitizeEmail = (value) => String(value || "").trim().toLowerCase();
const sanitizeName = (value) => String(value || "").trim();

// Requires at least 8 characters, one uppercase letter, one number, and one allowed symbol.
const isStrongPassword = (value) => /^(?=.*[A-Z])(?=.*\d)(?=.*[_*&%]).{8,}$/.test(value);

// Called after the OTP is saved; attempts delivery and returns only whether the email was sent,
// so a mail-provider failure does not stop the user from entering the saved OTP.
const trySendOTP = async (email, otp, purpose) => {
    try {
        await sendOTP(email, otp);
        return true;
    } catch (error) {
        console.error(`${purpose} OTP EMAIL DELIVERY ERROR:`, error);
        return false;
    }
};

// Restricts roles to the two application roles; public registration always creates patients.
const normalizeRole = (input) => {
    const role = String(input || "patient").trim();
    const normalized = role.toLowerCase();

    if (normalized === "admin" || normalized === "worker") {
        return "worker";
    }

    return normalized === "patient" ? "patient" : "patient";
};

// ================= REGISTER =================
// Creates a patient account, hashes the password, and sends an email-verification OTP.
const register = async (req, res) => {
    try {
        const fullname = sanitizeName(req.body.fullname);
        const age = Number(req.body.age);
        const gender = sanitizeName(req.body.gender);
        const email = sanitizeEmail(req.body.email);
        const password = String(req.body.password || "");

        if (!fullname || !email || !password || !gender || !Number.isInteger(age) || age < 0 || age > 120) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid full name, age, gender, email, and password."
            });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters and include an uppercase letter, a number, and one of these symbols: _ * & %."
            });
        }

        userModel.findUserByEmail(email, async (err, results) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Database error."
                });
            }

            if (results.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists."
                });
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedPassword = await bcrypt.hash(password, 10);

            userModel.createUser({
                fullname,
                age,
                gender,
                email,
                role: "patient",
                password: hashedPassword,
                otp,
                is_verified: 0
            },
                async (err) => {

                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: "Registration failed."
                        });
                    }

                    const emailSent = await trySendOTP(email, otp, "REGISTRATION");

                    return res.status(201).json({
                        success: true,
                        message: emailSent
                            ? "Registration successful! OTP sent to your email."
                            : "Registration successful! OTP saved, but email delivery failed."
                    });

                }
            );

        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// ================= LOGIN =================
// Verifies the password, creates a short-lived login OTP, and emails it to the user.
const login = (req, res) => {

    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required."
        });
    }

    userModel.getUserByEmail(email, async (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = results[0];

        if (user.is_verified == 0) {
            return res.status(401).json({
                success: false,
                message: "Please verify your email first."
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // Generate Login OTP
        const loginOTP = Math.floor(100000 + Math.random() * 900000).toString();

        // Expire after 5 minutes
        const expires = new Date(Date.now() + 5 * 60 * 1000);

        userModel.saveLoginOTP(email, loginOTP, expires, async (err) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to save login OTP."
                });
            }

            const emailSent = await trySendOTP(email, loginOTP, "LOGIN");

            return res.status(200).json({
                success: true,
                message: emailSent
                    ? "Login OTP sent to your email."
                    : "Login OTP saved, but email delivery failed."
            });

        });

    });

};

// ================= REGISTER OTP =================
// Confirms the registration OTP and marks the account as email-verified.
const verifyOTP = (req, res) => {

    const { email, otp } = req.body;

    userModel.getUserByEmail(email, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const user = results[0];

        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        userModel.verifyUser(email, (err) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Verification failed."
                });
            }

            return res.json({
                success: true,
                message: "Email verified successfully."
            });

        });

    });

};

// Starts password recovery by generating and emailing a time-limited reset OTP.
const forgotPassword = (req, res) => {

    const { email } = req.body;

    if (!email || !String(email).trim()) {
        return res.status(400).json({
            success: false,
            message: "Email is required."
        });
    }

    userModel.getUserByEmail(email.trim(), async (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No account found with that email."
            });
        }

        const user = results[0];

        if (user.is_verified == 0) {
            return res.status(400).json({
                success: false,
                message: "Please verify your email first."
            });
        }

        const resetOTP = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 5 * 60 * 1000);

        userModel.savePasswordResetOTP(email.trim(), resetOTP, expires, async (saveErr) => {

            if (saveErr) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to save reset code."
                });
            }

            const emailSent = await trySendOTP(email.trim(), resetOTP, "PASSWORD RESET");

            return res.status(200).json({
                success: true,
                message: emailSent
                    ? "Password reset OTP sent to your email."
                    : "Password reset OTP saved, but email delivery failed."
            });

        });

    });

};

// Validates the reset OTP, hashes the new password, and clears the recovery code.
const resetPassword = async (req, res) => {

    const email = sanitizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !otp || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Email, OTP, and new password are required."
        });
    }

    if (!isStrongPassword(newPassword)) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters and include an uppercase letter, a number, and one of these symbols: _ * & %."
        });
    }

    userModel.verifyPasswordResetOTP(email.trim(), otp.trim(), async (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset code."
            });
        }

        try {

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            userModel.updatePassword(email.trim(), hashedPassword, (updateErr) => {

                if (updateErr) {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to update password."
                    });
                }

                userModel.clearPasswordResetOTP(email.trim(), (clearErr) => {

                    if (clearErr) {
                        return res.status(500).json({
                            success: false,
                            message: "Password updated but reset code cleanup failed."
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Password reset successfully."
                    });

                });

            });

        } catch (error) {

            return res.status(500).json({
                success: false,
                message: "Unable to process password reset.",
                error: error.message
            });

        }

    });

};

// Verifies the second login factor and returns a signed JWT for future API requests.
const verifyLoginOTP = (req, res) => {

    const { email, otp } = req.body;

    userModel.verifyLoginOTP(email, otp, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        const user = results[0];

        // Generate JWT
        const token = jwt.sign(
    {
        id: user.id,
        email: user.email,
        role: user.role
    },
    process.env.JWT_SECRET,
    {
        expiresIn: process.env.JWT_EXPIRES_IN
    }
);

        // Clear OTP after successful login
        userModel.clearLoginOTP(email, (err) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to clear OTP."
                });
            }

            return res.status(200).json({
                success: true,
                message: "Login successful!",
                token,

                user: {
                    id: user.id,
                    fullname: user.fullname,
                    age: user.age,
                    gender: user.gender,
                    email: user.email,
                    role: user.role
                }
            });

        });

    });

};

// ================= UPDATE PROFILE =================
// Updates editable profile fields for the user identified by the JWT.
const updateProfile = (req, res) => {
    const fullname = String(req.body.fullname || "").trim();
    const age = Number(req.body.age);
    const gender = String(req.body.gender || "").trim();

    if (!fullname || !Number.isInteger(age) || age < 0 || age > 120 || !gender) {
        return res.status(400).json({
            success: false,
            message: "Full name, age, and gender are required."
        });
    }

    userModel.updateProfile(req.user.id, fullname, age, gender, (err, result) => {
        if (err) {
            console.error("UPDATE PROFILE ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to save profile."
            });
        }

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        userModel.getProfileById(req.user.id, (profileErr, profileResults) => {
            if (profileErr) {
                console.error("GET UPDATED PROFILE ERROR:", profileErr);
                return res.status(500).json({
                    success: false,
                    message: "Profile saved, but the updated record could not be loaded."
                });
            }

            const savedUser = profileResults[0] || {
                id: req.user.id,
                fullname,
                age,
                gender,
                role: req.user.role,
                job_specification: null
            };

            return res.status(200).json({
                success: true,
                user: {
                    id: savedUser.id,
                    fullname: savedUser.fullname,
                    age: savedUser.age,
                    gender: savedUser.gender,
                    role: savedUser.role,
                    job_specification: savedUser.job_specification
                }
            });
        });
    });
};

// Returns the authenticated user's profile without exposing the password hash.
const getProfile = (req, res) => {
    userModel.getProfileById(req.user.id, (err, results) => {
        if (err) {
            console.error("GET PROFILE ERROR:", err);
            return res.status(500).json({ success: false, message: "Failed to load profile." });
        }

        if (!results.length) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        return res.status(200).json({ success: true, user: results[0] });
    });
};

module.exports = {
    register,
    login,
    verifyOTP,
    forgotPassword,
    resetPassword,
    verifyLoginOTP,
    updateProfile,
    getProfile
};