require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const db = require("./database/db");

const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const announcementModel = require("./models/announcementModel");
const medicalReportRoutes = require("./routes/medicalReportRoutes");
const medicalReportModel = require("./models/medicalReportModel");
const appointmentModel = require("./models/appointmentModel");

const verifyToken = require("./middleware/authMiddleware");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5500,http://127.0.0.1:5500").split(",").map((origin) => origin.trim()).filter(Boolean);

// ================= CORS =================

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));


// ================= MIDDLEWARE =================

app.use(express.json());


// ================= ROUTES =================

app.use("/api/auth", authRoutes);

app.use("/api/appointments", appointmentRoutes);

app.use("/api/announcements", announcementRoutes);
app.use("/api/medical-reports", medicalReportRoutes);


// ================= TEST BACKEND =================

app.get("/", (req, res) => {
    res.send("Backend Working");
});

// ================= PROTECTED DASHBOARD =================

app.get("/dashboard", verifyToken, (req, res) => {

    res.json({
        success: true,
        message: "Welcome to the Dashboard!",
        user: req.user
    });

});


// ================= START SERVER =================

const port = Number(process.env.PORT) || 3000;

appointmentModel.addFileColumns((fileErr) => {
    if (fileErr) console.error("APPOINTMENT FILE COLUMNS ERROR:", fileErr);
    medicalReportModel.createTable((reportErr) => {
        if (reportErr) console.error("MEDICAL REPORT TABLE ERROR:", reportErr);
        announcementModel.createTable((err) => {
            if (err) console.error("ANNOUNCEMENTS TABLE ERROR:", err);
            app.listen(port, () => {
                console.log(`✅ Server running on port ${port}`);
            });
        });
    });
});