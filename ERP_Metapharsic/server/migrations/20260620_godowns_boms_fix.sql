-- Migration to fix Godowns and BOMs table schemas
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS parent varchar(255) DEFAULT 'Primary';
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS is_third_party boolean DEFAULT false;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS manager varchar(255);

ALTER TABLE boms ADD COLUMN IF NOT EXISTS bom_name varchar(255);
ALTER TABLE boms ADD COLUMN IF NOT EXISTS std_cost numeric(10,2) DEFAULT 0.00;
