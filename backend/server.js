// Loads deployment secrets and configuration before any application services start.
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const db = require("./database/db");

const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const announcementModel = require("./models/announcementModel");
const medicalReportRoutes = require("./routes/medicalReportRoutes");
const medicalReportModel = require("./models/medicalReportModel");
const appointmentModel = require("./models/appointmentModel");
const userModel = require("./models/userModel");

const verifyToken = require("./middleware/authMiddleware");

// Express coordinates security middleware, API routes, and server responses.
const app = express();

// Render places the service behind one reverse proxy; trust it for client IP detection.
app.set("trust proxy", 1);

const requiredEnv = ["JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");
if (missingEnv.length > 0) {
    console.warn(`⚠️ Missing required environment variables: ${missingEnv.join(", ")}`);
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5500,http://127.0.0.1:5500,https://sigla-tala.netlify.app,https://siglatala.netlify.app,https://siglata.netlify.app").split(",").map((origin) => origin.trim()).filter(Boolean);

// Allows browser requests only from configured frontend domains and local development hosts.
function isAllowedOrigin(origin) {
    if (!origin) return true;

    if (allowedOrigins.includes(origin)) {
        return true;
    }

    return /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^(https?:\/\/)([a-z0-9-]+\.)*netlify\.app$/.test(origin);
}

// ================= CORS =================

app.use(cors({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));

app.disable("x-powered-by");
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));

// Applies a general request limit to reduce abuse of public API endpoints.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

// Applies a stricter limit to login and OTP endpoints because they are sensitive operations.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later."
    }
});

// ================= MIDDLEWARE =================

app.use(apiLimiter);
app.use("/api/auth", authLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));


// ================= ROUTES =================

app.use("/api/auth", authRoutes);

app.use("/api/appointments", appointmentRoutes);

app.use("/api/announcements", announcementRoutes);
app.use("/api/medical-reports", medicalReportRoutes);


// ================= TEST BACKEND =================

// Simple health endpoint used to confirm that the deployed service is running.
app.get("/", (req, res) => {
    res.send("Backend Working");
});

// Returns a consistent JSON response when no route matches the request.
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

// ================= PROTECTED DASHBOARD =================

// Demonstrates a protected endpoint: verifyToken runs before the dashboard response.
app.get("/dashboard", verifyToken, (req, res) => {

    res.json({
        success: true,
        message: "Welcome to the Dashboard!",
        user: req.user
    });

});


// ================= START SERVER =================

// Render supplies PORT in production; localhost falls back to port 3000.
const port = Number(process.env.PORT) || 3000;

userModel.ensureSchema((userErr) => {
    if (userErr) {
        console.error("USER TABLE SCHEMA ERROR:", userErr);
    }

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
});