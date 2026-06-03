const db = require('../db');

async function migrate() {
  try {
    console.log("Connecting to db to add columns to users table...");
    
    // Add reset_token column
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE
    `);
    
    console.log("Successfully updated users table with reset_token and reset_token_expires columns!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
