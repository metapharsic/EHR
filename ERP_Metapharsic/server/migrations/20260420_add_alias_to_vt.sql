-- Migration: Add alias to voucher_types
-- Date: 2026-04-20

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='voucher_types' AND column_name='alias') THEN
        ALTER TABLE voucher_types ADD COLUMN alias VARCHAR(100);
    END IF;
END $$;
