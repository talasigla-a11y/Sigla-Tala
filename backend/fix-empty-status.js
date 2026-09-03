const db = require("./database/db");

// Fix existing empty status values to 'Pending'
const sql = `UPDATE appointments SET status = 'Pending' WHERE status = ''`;

console.log("Fixing empty status values to 'Pending'...");
db.query(sql, (err, result) => {
    if (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
    console.log(`✅ Updated ${result.affectedRows} row(s)`);
    
    // Verify the fix
    db.query("SELECT id, status FROM appointments", (err, rows) => {
        if (err) {
            console.error("Error:", err);
            process.exit(1);
        }
        console.log("\nAppointments after fix:");
        console.table(rows);
        
        process.exit(0);
    });
});
