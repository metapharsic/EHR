const db = require('../db');

async function insertTestUser() {
  console.log('Checking/creating testuser with ID 00000000-0000-0000-0000-000000000001...');
  try {
    const userId = '00000000-0000-0000-0000-000000000001';
    
    // Check if user exists
    const checkRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (checkRes.rows.length === 0) {
      // Insert user
      await db.query(
        `INSERT INTO users (id, username, email, password_hash, name, role, created_at, two_factor_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), false)`,
        [userId, 'testuser', 'test@metapharsic.com', '$2a$10$Wp1GL3la1AuMWpUA1i6GuuZrhpoznHoEviGVZUdwk6taP/TqkWGSa', 'Test User', 'ADMIN']
      );
      console.log('✅ testuser created successfully!');
    } else {
      console.log('ℹ️  testuser already exists.');
    }
  } catch (error) {
    console.error('❌ Failed to insert testuser:', error.message);
  } finally {
    process.exit(0);
  }
}

insertTestUser();
