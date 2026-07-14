const { hashPassword } = require('./server/utils/password');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool();

(async () => {
  const { rows } = await pool.query(
    "SELECT id, email FROM users WHERE role='STAFF' AND email IN ('rajesh.kumar@metapharsic.com','priya.sharma@metapharsic.com','sneha.gupta@metapharsic.com','amit.patel@metapharsic.com')"
  );
  for (const u of rows) {
    const pw = 'Kapila@' + Math.floor(1000 + Math.random() * 9000);
    const hash = await hashPassword(pw);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, u.id]);
    console.log(u.email, pw);
  }
  await pool.query(
    "UPDATE employees e SET user_id = u.id FROM users u WHERE e.email = u.email AND e.user_id IS NULL"
  );
  console.log('linked employees done');
  process.exit(0);
})();
