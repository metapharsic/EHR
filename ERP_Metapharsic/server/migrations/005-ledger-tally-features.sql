-- Add Tally ERP inspired features to chart_of_accounts
ALTER TABLE chart_of_accounts 
ADD COLUMN IF NOT EXISTS alias VARCHAR(255),
ADD COLUMN IF NOT EXISTS inventory_affected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ledger_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS activate_interest BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mailing_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS mailing_address TEXT,
ADD COLUMN IF NOT EXISTS mailing_country VARCHAR(100) DEFAULT 'India',
ADD COLUMN IF NOT EXISTS mailing_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS provide_bank_details BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pan_it_no VARCHAR(20);

-- Ensure updated_at is handled if not already
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chart_of_accounts' AND column_name = 'updated_at') THEN
        ALTER TABLE chart_of_accounts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
