const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

const sql = `
-- Create stock_journals table
CREATE TABLE IF NOT EXISTS stock_journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    journal_number VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    narration TEXT,
    status VARCHAR(50) DEFAULT 'Approved',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_journal_items table
CREATE TABLE IF NOT EXISTS stock_journal_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID REFERENCES stock_journals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    godown_id UUID REFERENCES godowns(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    qty INTEGER NOT NULL,
    rate NUMERIC(10, 2) DEFAULT 0,
    amount NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_transfers table
CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    source_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    dest_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    narration TEXT,
    status VARCHAR(50) DEFAULT 'In Transit',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_transfer_items table
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    godown_id UUID REFERENCES godowns(id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    qty INTEGER NOT NULL,
    rate NUMERIC(10, 2) DEFAULT 0,
    amount NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function main() {
  try {
    console.log('Creating missing inventory/stock tables...');
    await pool.query(sql);
    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await pool.end();
  }
}

main();
