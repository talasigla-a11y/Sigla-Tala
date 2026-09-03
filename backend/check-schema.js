const db = require("./database/db");

// Check appointments table schema
db.query("DESC appointments", (err, results) => {
    if (err) {
        console.error("Error:", err);
        process.exit(1);
    }
    console.log("Appointments table schema:");
    console.table(results);
    
    // Now check the actual data
    db.query("SELECT id, status, HEX(status) as hex_status FROM appointments", (err, rows) => {
        if (err) {
            console.error("Error:", err);
            process.exit(1);
        }
        console.log("\nAppointments data:");
        console.table(rows);
        
        process.exit(0);
    });
});
