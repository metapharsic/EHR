const db = require('../db');

async function test() {
  try {
    console.log('Inserting return directly into order_returns...');
    const res = await db.query(
      "INSERT INTO order_returns (order_id, reason) VALUES ('7ddad313-e237-48bc-b16c-43786e82f1eb', 'Test direct insert') RETURNING *"
    );
    console.log('✅ Direct Insert SUCCESS:', res.rows[0]);
  } catch (e) {
    console.error('❌ Direct Insert FAILED:', e.message);
  } finally {
    process.exit(0);
  }
}

test();
