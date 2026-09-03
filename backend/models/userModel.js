const db = require("../database/db");


// ========================================
// FIND USER BY EMAIL
// ========================================
const findUserByEmail = (email, callback) => {

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], callback);
};


// ========================================
// GET USER BY EMAIL
// ========================================
const getUserByEmail = (email, callback) => {

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], callback);
};


// ========================================
// CREATE USER
// ========================================
const createUser = (user, callback) => {

    const sql = `
        INSERT INTO users
        (
            fullname,
            age,
            gender,
            email,
            role,
            password,
            otp,
            is_verified
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            user.fullname,
            user.age,
            user.gender,
            user.email,
            user.role || "patient",
            user.password,
            user.otp,
            user.is_verified
        ],
        callback
    );
};


// ========================================
// SAVE LOGIN OTP
// ========================================
const saveLoginOTP = (email, otp, expires, callback) => {

    const sql = `
        UPDATE users
        SET
            login_otp = ?,
            login_otp_expires = ?
        WHERE email = ?
    `;

    db.query(
        sql,
        [otp, expires, email],
        callback
    );
};


// ========================================
// VERIFY LOGIN OTP
// ========================================
const verifyLoginOTP = (email, otp, callback) => {

    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
        AND login_otp = ?
        AND login_otp_expires > NOW()
    `;

    db.query(
        sql,
        [email, otp],
        callback
    );
};


// ========================================
// CLEAR LOGIN OTP
// ========================================
const clearLoginOTP = (email, callback) => {

    const sql = `
        UPDATE users
        SET
            login_otp = NULL,
            login_otp_expires = NULL
        WHERE email = ?
    `;

    db.query(sql, [email], callback);
};


// ========================================
// SAVE PASSWORD RESET OTP
// ========================================
const savePasswordResetOTP = (email, otp, expires, callback) => {

    const sql = `
        UPDATE users
        SET
            reset_otp = ?,
            reset_otp_expires = ?
        WHERE email = ?
    `;

    db.query(
        sql,
        [otp, expires, email],
        callback
    );
};


// ========================================
// VERIFY PASSWORD RESET OTP
// ========================================
const verifyPasswordResetOTP = (email, otp, callback) => {

    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
        AND reset_otp = ?
        AND reset_otp_expires > NOW()
    `;

    db.query(
        sql,
        [email, otp],
        callback
    );
};


// ========================================
// CLEAR PASSWORD RESET OTP
// ========================================
const clearPasswordResetOTP = (email, callback) => {

    const sql = `
        UPDATE users
        SET
            reset_otp = NULL,
            reset_otp_expires = NULL
        WHERE email = ?
    `;

    db.query(sql, [email], callback);
};


// ========================================
// UPDATE PASSWORD
// ========================================
const updatePassword = (email, passwordHash, callback) => {

    const sql = `
        UPDATE users
        SET
            password = ?
        WHERE email = ?
    `;

    db.query(sql, [passwordHash, email], callback);
};

const updateProfile = (userId, fullname, age, gender, callback) => {

    const sql = `
        UPDATE users
        SET
            fullname = ?,
            age = ?,
            gender = ?
        WHERE id = ?
    `;

    db.query(sql, [fullname, age, gender, userId], callback);
};

const getProfileById = (userId, callback) => {
    const sql = `
        SELECT id, fullname, age, gender, email, role
        FROM users
        WHERE id = ?
    `;

    db.query(sql, [userId], callback);
};


// ========================================
// VERIFY REGISTRATION EMAIL
// ========================================
const verifyUser = (email, callback) => {

    const sql = `
        UPDATE users
        SET
            is_verified = 1,
            otp = NULL
        WHERE email = ?
    `;

    db.query(sql, [email], callback);
};


// ========================================
// EXPORT
// ========================================
module.exports = {
    findUserByEmail,
    getUserByEmail,
    createUser,
    saveLoginOTP,
    verifyLoginOTP,
    clearLoginOTP,
    savePasswordResetOTP,
    verifyPasswordResetOTP,
    clearPasswordResetOTP,
    updatePassword,
    updateProfile,
    getProfileById,
    verifyUser
};