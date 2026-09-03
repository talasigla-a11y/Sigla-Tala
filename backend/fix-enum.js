const db = require("./database/db");

// Alter the appointments table to fix the status enum
const sql = `ALTER TABLE appointments 
             MODIFY COLUMN status ENUM('Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled') 
             DEFAULT 'Pending'`;

console.log("Fixing appointments status enum...");
db.query(sql, (err, result) => {
    if (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
    console.log("✅ Successfully modified status column!");
    console.log("New enum values: 'Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled'");
    
    process.exit(0);
});
