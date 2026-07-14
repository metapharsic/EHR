const bcrypt = require('bcryptjs');
const db = require('../db');

async function resetAdmin() {
  console.log('Resetting Admin user account in database...');
  try {
    const password = 'Admin@1234';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const res = await db.query(
      `UPDATE users 
       SET password_hash = $1, 
           login_attempts = 0, 
           locked_until = NULL, 
           risk_score = 0,
           updated_at = NOW() 
       WHERE username = $2 
       RETURNING id, username, email`,
      [hashedPassword, 'admin']
    );

    if (res.rows.length > 0) {
      console.log('✅ Admin account reset successfully!');
      console.log('Username: admin');
      console.log('Password: Admin@1234');
      console.log('User Details:', res.rows[0]);
    } else {
      console.log('❌ Admin user "admin" not found in the users table!');
    }
  } catch (error) {
    console.error('❌ Failed to reset admin user:', error.message);
  } finally {
    process.exit(0);
  }
}

resetAdmin();
