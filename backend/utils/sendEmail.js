const sendEmail = require("./gmailSender");

const sendOTP = async (email, otp) => {
    await sendEmail({
        to: email,
        subject: "SIGLA TALA Email Verification",
        html: `
            <h2>Email Verification</h2>
            <p>Your verification code is:</p>
            <h1>${otp}</h1>
            <p>This code expires in 10 minutes.</p>
        `
    });
};

module.exports = sendOTP;