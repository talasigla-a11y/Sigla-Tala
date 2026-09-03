const db = require("./database/db");

// Reset all statuses to 'Pending'
const sql = `UPDATE appointments SET status = 'Pending'`;

console.log("Resetting all appointments to 'Pending'...");
db.query(sql, (err, result) => {
    if (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
    console.log(`✅ Updated ${result.affectedRows} row(s)`);
    
    // Verify the reset
    db.query("SELECT id, status FROM appointments", (err, rows) => {
        if (err) {
            console.error("Error:", err);
            process.exit(1);
        }
        console.log("\nAppointments after reset:");
        console.table(rows);
        
        process.exit(0);
    });
});
