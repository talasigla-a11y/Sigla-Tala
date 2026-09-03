const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const sendOTP = require("../utils/sendEmail");

// ================= REGISTER =================
const register = async (req, res) => {
    try {
        const { fullname, age, gender, email, password } = req.body;

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

           userModel.createUser(
    {
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

                    try {

                        await sendOTP(email, otp);

                        return res.status(201).json({
                            success: true,
                            message: "Registration successful! OTP sent to your email."
                        });

                    } catch (emailError) {

                        return res.status(500).json({
                            success: false,
                            message: "User created but failed to send OTP email.",
                            error: emailError.message
                        });

                    }

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
const login = (req, res) => {

    const { email, password } = req.body;

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

            try {

                await sendOTP(email, loginOTP);

                return res.status(200).json({
                    success: true,
                    message: "Login OTP sent to your email."
                });

            } catch (error) {

    console.log("EMAIL ERROR:", error);

    return res.status(500).json({
        success: false,
        message: "Failed to send OTP email.",
        error: error.message
    });

}

        });

    });

};

// ================= REGISTER OTP =================
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

            try {

                await sendOTP(email.trim(), resetOTP);

                return res.status(200).json({
                    success: true,
                    message: "Password reset OTP sent to your email."
                });

            } catch (error) {

                console.log("EMAIL ERROR:", error);

                return res.status(500).json({
                    success: false,
                    message: "Failed to send OTP email.",
                    error: error.message
                });

            }

        });

    });

};

const resetPassword = async (req, res) => {

    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Email, OTP, and new password are required."
        });
    }

    if (String(newPassword).length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters long."
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

        return res.status(200).json({
            success: true,
            user: { id: req.user.id, fullname, age, gender }
        });
    });
};

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