const db = require("./database/db");

// Fix empty status values
const sql = "UPDATE appointments SET status = 'Pending' WHERE status = '' OR status IS NULL";

db.query(sql, (err, result) => {
    if (err) {
        console.error("Error updating status:", err);
        process.exit(1);
    }
    
    console.log("✅ Updated", result.affectedRows, "appointments with status 'Pending'");
    
    // Verify the updates
    db.query("SELECT id, appointment_type, status FROM appointments", (err, results) => {
        if (err) {
            console.error("Error fetching appointments:", err);
            process.exit(1);
        }
        
        console.log("\nCurrent appointments:");
        results.forEach(apt => {
            console.log(`  ID ${apt.id}: ${apt.appointment_type} - Status: ${apt.status}`);
        });
        
        process.exit(0);
    });
});
