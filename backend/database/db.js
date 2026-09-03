const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "siglatala",
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

connection.connect((err) => {
    if (err) {
        console.error(err);
    } else {
        console.log("✅ Connected!");
    }
});

module.exports = connection;