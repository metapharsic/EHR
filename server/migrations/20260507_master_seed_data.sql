-- =====================================================================
-- 20260507_master_seed_data.sql
-- Description: Master Seed Script for Metapharsic Lifesciences ERP
-- Purpose: Inserts realistic dummy data for testing and development.
-- =====================================================================

-- Note: The following script uses hardcoded UUIDs to preserve 
-- referential integrity between tables during insertion.
-- If running multiple times, ensure you handle duplicates. The script 
-- uses ON CONFLICT DO NOTHING where unique constraints are available.

-- ---------------------------------------------------------
-- 1. Users & Roles
-- ---------------------------------------------------------
-- Password hash is '$2a$10$WqB... ' which corresponds to 'admin123'
INSERT INTO users (id, username, password_hash, name, role) VALUES 
('11111111-1111-1111-1111-111111111111', 'admin', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'System Admin', 'ADMIN'),
('22222222-2222-2222-2222-222222222222', 'pharmacist1', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'John Doe', 'PHARMACIST'),
('22222222-2222-2222-2222-222222222223', 'accountant', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'Jane Smith', 'ACCOUNTANT')
ON CONFLICT (username) DO NOTHING;

-- ---------------------------------------------------------
-- 2. Products Master
-- ---------------------------------------------------------
-- Note: schema doesn't have unique constraint on product name, so we just insert.
-- It's recommended to run this on an empty database or handle duplicates manually.
INSERT INTO products (id, name, generic_name, manufacturer, source, therapeutic_category, packing, uom, hsn, gst, min_stock_level, reorder_level, schedule_type) VALUES
('33333333-3333-3333-3333-333333333331', 'Dolo 650', 'Paracetamol 650mg', 'Micro Labs', 'TRADING', 'Analgesic/Antipyretic', '15x10', 'Strip', '30049099', 12.00, 100, 200, 'OTC'),
('33333333-3333-3333-3333-333333333332', 'Augmentin 625 Duo', 'Amoxicillin + Clavulanic Acid', 'GSK', 'TRADING', 'Antibiotic', '10x10', 'Strip', '30049099', 12.00, 50, 100, 'H'),
('33333333-3333-3333-3333-333333333333', 'Corex Syrup 100ml', 'Chlorpheniramine + Codeine', 'Pfizer', 'TRADING', 'Antitussive', '100ml', 'Bottle', '30049099', 12.00, 20, 50, 'H'),
('33333333-3333-3333-3333-333333333334', 'Pantocid DSR', 'Pantoprazole + Domperidone', 'Sun Pharma', 'TRADING', 'Antacid', '15x10', 'Strip', '30049099', 12.00, 80, 150, 'OTC'),
('33333333-3333-3333-3333-333333333335', 'Metapharsic MultiVit', 'Multivitamin Complex', 'Metapharsic', 'OWN_MANUFACTURING', 'Vitamin Supplement', '30s', 'Bottle', '21069099', 18.00, 200, 500, 'OTC');

-- ---------------------------------------------------------
-- 3. Product Batches (Inventory)
-- ---------------------------------------------------------
INSERT INTO batches (id, product_id, batch_number, expiry_date, manufacturing_date, stock, mrp, purchase_rate, selling_rate, location) VALUES
('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', 'B-DOLO-001', CURRENT_DATE + INTERVAL '2 years', CURRENT_DATE - INTERVAL '1 month', 500, 30.00, 20.00, 25.00, 'RACK-A1'),
('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333332', 'B-AUG-001', CURRENT_DATE + INTERVAL '1 year', CURRENT_DATE - INTERVAL '2 months', 200, 200.00, 150.00, 180.00, 'RACK-A2'),
('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333', 'B-COR-001', CURRENT_DATE + INTERVAL '18 months', CURRENT_DATE - INTERVAL '1 month', 100, 115.00, 85.00, 100.00, 'RACK-B1'),
('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333334', 'B-PAN-001', CURRENT_DATE + INTERVAL '3 years', CURRENT_DATE - INTERVAL '6 months', 300, 150.00, 100.00, 130.00, 'RACK-C1'),
('44444444-4444-4444-4444-444444444445', '33333333-3333-3333-3333-333333333335', 'B-META-001', CURRENT_DATE + INTERVAL '2 years', CURRENT_DATE, 1000, 250.00, 100.00, 200.00, 'RACK-M1')
ON CONFLICT (product_id, batch_number) DO NOTHING;

-- ---------------------------------------------------------
-- 4. Parties (Suppliers & Customers)
-- ---------------------------------------------------------
INSERT INTO parties (id, name, type, gstin, mobile, email, address, city, state, credit_limit, current_balance) VALUES
('55555555-5555-5555-5555-555555555551', 'Apollo Distributors', 'Creditor', '29ABCDE1234F1Z5', '9876543210', 'orders@apollodist.com', '123 Pharma Street', 'Bangalore', 'Karnataka', 500000.00, -25000.00),
('55555555-5555-5555-5555-555555555552', 'National Medicos', 'Creditor', '27XYZA1234B2Z4', '9988776655', 'supply@nationalmed.com', '45 Health Ave', 'Mumbai', 'Maharashtra', 200000.00, 0.00),
('55555555-5555-5555-5555-555555555553', 'City Hospital Pharmacy', 'Debtor', '07HOSP1234C3Z3', '9898989898', 'pharmacy@cityhospital.com', 'Main Road', 'Delhi', 'Delhi', 100000.00, 15000.00),
('55555555-5555-5555-5555-555555555554', 'Generic Retail Store', 'Debtor', '33RETA1234D4Z2', '9797979797', 'billing@genericretail.com', 'Market Square', 'Chennai', 'Tamil Nadu', 50000.00, 5000.00);

-- ---------------------------------------------------------
-- 5. Sales Invoices & Items
-- ---------------------------------------------------------
INSERT INTO sales_invoices (id, invoice_number, date, customer_name, customer_mobile, doctor_name, payment_mode, sub_total, taxable_value, total_gst, total_discount, round_off, net_amount, status, created_by) VALUES
('66666666-6666-6666-6666-666666666661', 'INV-2026-0001', CURRENT_DATE - INTERVAL '2 days', 'Walk-in Customer', '9123456780', 'Dr. Ramesh', 'Cash', 205.00, 183.04, 21.96, 0.00, 0.04, 205.00, 'Completed', '11111111-1111-1111-1111-111111111111'),
('66666666-6666-6666-6666-666666666662', 'INV-2026-0002', CURRENT_DATE - INTERVAL '1 day', 'City Hospital Pharmacy', '9898989898', NULL, 'Credit', 3100.00, 2767.86, 332.14, 0.00, 0.14, 3100.00, 'Completed', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO sales_invoice_items (invoice_id, product_id, batch_id, quantity, mrp, rate, taxable_value, gst_percent, cgst_amount, sgst_amount, total_amount) VALUES
('66666666-6666-6666-6666-666666666661', '33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444441', 1, 30.00, 25.00, 22.32, 12.00, 1.34, 1.34, 25.00),
('66666666-6666-6666-6666-666666666661', '33333333-3333-3333-3333-333333333332', '44444444-4444-4444-4444-444444444442', 1, 200.00, 180.00, 160.71, 12.00, 9.64, 9.64, 180.00),

('66666666-6666-6666-6666-666666666662', '33333333-3333-3333-3333-333333333334', '44444444-4444-4444-4444-444444444444', 10, 150.00, 130.00, 1160.71, 12.00, 69.64, 69.64, 1300.00),
('66666666-6666-6666-6666-666666666662', '33333333-3333-3333-3333-333333333332', '44444444-4444-4444-4444-444444444442', 10, 200.00, 180.00, 1607.14, 12.00, 96.43, 96.43, 1800.00);

-- ---------------------------------------------------------
-- 6. Purchases & Items
-- ---------------------------------------------------------
INSERT INTO purchases (id, supplier_id, invoice_number, date, total_amount, status, payment_status) VALUES
('77777777-7777-7777-7777-777777777771', '55555555-5555-5555-5555-555555555551', 'PO-AP-9923', CURRENT_DATE - INTERVAL '10 days', 50000.00, 'Received', 'Unpaid');

INSERT INTO purchase_items (purchase_id, product_id, batch_number, expiry_date, quantity, purchase_rate, mrp, gst_percent, amount) VALUES
('77777777-7777-7777-7777-777777777771', '33333333-3333-3333-3333-333333333331', 'B-DOLO-002', CURRENT_DATE + INTERVAL '2 years', 500, 20.00, 30.00, 12.00, 10000.00),
('77777777-7777-7777-7777-777777777771', '33333333-3333-3333-3333-333333333332', 'B-AUG-002', CURRENT_DATE + INTERVAL '1 year', 200, 150.00, 200.00, 12.00, 30000.00),
('77777777-7777-7777-7777-777777777771', '33333333-3333-3333-3333-333333333334', 'B-PAN-002', CURRENT_DATE + INTERVAL '3 years', 100, 100.00, 150.00, 12.00, 10000.00);

-- ---------------------------------------------------------
-- 7. Expenses
-- ---------------------------------------------------------
INSERT INTO expenses (category, description, amount, date, paid_by, payment_mode) VALUES
('Rent', 'Office & Warehouse Rent - May', 15000.00, CURRENT_DATE - INTERVAL '5 days', 'Admin', 'Bank Transfer'),
('Electricity', 'Monthly Bill', 2500.00, CURRENT_DATE - INTERVAL '3 days', 'Admin', 'UPI'),
('Internet', 'Broadband Services', 1000.00, CURRENT_DATE - INTERVAL '2 days', 'Admin', 'UPI');

-- ---------------------------------------------------------
-- 8. Chart of Accounts (Basic Setup for Enterprise)
-- ---------------------------------------------------------
INSERT INTO chart_of_accounts (id, account_code, account_name, account_type, account_group, opening_balance, account_format) VALUES
('88888888-8888-8888-8888-888888888881', 'ASST-001', 'Cash in Hand', 'Asset', 'Current Assets', 50000.00, 'debit'),
('88888888-8888-8888-8888-888888888882', 'ASST-002', 'HDFC Bank C/A', 'Asset', 'Bank Accounts', 250000.00, 'debit'),
('88888888-8888-8888-8888-888888888883', 'INC-001', 'Sales Account', 'Income', 'Direct Income', 0.00, 'credit'),
('88888888-8888-8888-8888-888888888884', 'EXP-001', 'Purchase Account', 'Expense', 'Direct Expenses', 0.00, 'debit'),
('88888888-8888-8888-8888-888888888885', 'EXP-002', 'Rent Expense', 'Expense', 'Indirect Expenses', 0.00, 'debit')
ON CONFLICT (account_code) DO NOTHING;

-- ---------------------------------------------------------
-- 9. Journal Vouchers & General Ledger (Sample)
-- ---------------------------------------------------------
INSERT INTO journal_vouchers (id, voucher_no, voucher_date, narration, total_debit, total_credit, status, created_by) VALUES
('99999999-9999-9999-9999-999999999991', 'JV-2026-001', CURRENT_DATE - INTERVAL '5 days', 'Rent Paid for the month', 15000.00, 15000.00, 'Posted', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (voucher_no) DO NOTHING;

INSERT INTO journal_voucher_entries (voucher_id, account_id, debit, credit, narration) VALUES
('99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888885', 15000.00, 0.00, 'Rent Expense'),
('99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888882', 0.00, 15000.00, 'Paid from HDFC Bank');

-- General Ledger entries for the voucher
INSERT INTO general_ledger (account_id, voucher_id, voucher_type, transaction_date, debit, credit, running_balance, is_reconciled) VALUES
('88888888-8888-8888-8888-888888888885', '99999999-9999-9999-9999-999999999991', 'JV', CURRENT_DATE - INTERVAL '5 days', 15000.00, 0.00, 15000.00, TRUE),
('88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999991', 'JV', CURRENT_DATE - INTERVAL '5 days', 0.00, 15000.00, 235000.00, FALSE);

-- Done!
