const db = require('./db');

async function migrate() {
  try {
    await db.query(`
      ALTER TABLE parties
        ADD COLUMN IF NOT EXISTS pin_code        VARCHAR(10)  DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS credit_days     INTEGER      DEFAULT 0,
        ADD COLUMN IF NOT EXISTS category        VARCHAR(50)  DEFAULT 'Regular',
        ADD COLUMN IF NOT EXISTS contact_person  VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS pan             VARCHAR(20)  DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS route           VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS territory       VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS remarks         TEXT         DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS bank_name       VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS account_number  VARCHAR(50)  DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS ifsc_code       VARCHAR(20)  DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS drug_license_no VARCHAR(100) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ  DEFAULT NOW()
    `);
    console.log('✓ Columns added');

    await db.query('CREATE INDEX IF NOT EXISTS idx_parties_type_status ON parties (type, status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_parties_mobile ON parties (mobile)');
    console.log('✓ Indexes created');

    const { rows } = await db.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', ['parties']);
    console.log('Final columns:', rows.map(r => r.column_name).join(', '));

    process.exit(0);
  } catch (e) {
    console.error('Migration error:', e.message);
    process.exit(1);
  }
}

migrate();
