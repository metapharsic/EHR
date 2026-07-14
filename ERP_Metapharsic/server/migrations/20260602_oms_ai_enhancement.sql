-- Migration: 20260602_oms_ai_enhancement.sql
-- Description: Upgrade the Order Management System (OMS) into an AI-era, enterprise B2B
--              order module. Adds order lifecycle fields, AI insight columns, human-readable
--              order numbers, inventory/billing linkage, status history and shipment tracking.
-- Safe to re-run: all statements are idempotent.

-- ============================================
-- 1. ENHANCE ORDERS TABLE
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS godown_id UUID REFERENCES godowns(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ai_risk_score INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ai_risk_level VARCHAR(20);          -- Low, Medium, High
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(20);      -- Approve, Review, Hold
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ai_insight TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(30) DEFAULT 'Unfulfilled'; -- Unfulfilled, Reserved, Fulfilled, Invoiced
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Unique constraint on order_number (added separately so re-runs don't fail on existing rows)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_number_key'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
    END IF;
END$$;

-- ============================================
-- 2. ENHANCE ORDER ITEMS TABLE
-- ============================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipped_quantity INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS free_quantity INTEGER DEFAULT 0;

-- ============================================
-- 3. ORDER STATUS HISTORY (Audit trail of lifecycle transitions)
-- ============================================
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    note TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. ORDER SHIPMENTS (Logistics linkage)
-- ============================================
CREATE TABLE IF NOT EXISTS order_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    carrier VARCHAR(120),
    tracking_number VARCHAR(120),
    status VARCHAR(50) DEFAULT 'Dispatched', -- Dispatched, In Transit, Delivered, Returned
    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. HUMAN-READABLE ORDER NUMBER (ORD-YYYY-00001)
-- ============================================
CREATE SEQUENCE IF NOT EXISTS oms_order_seq START 1;

CREATE OR REPLACE FUNCTION fn_assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'ORD-' || to_char(COALESCE(NEW.order_date, CURRENT_DATE), 'YYYY')
                            || '-' || lpad(nextval('oms_order_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_order_number ON orders;
CREATE TRIGGER trg_assign_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_assign_order_number();

-- Backfill order_number for any pre-existing rows that lack one
UPDATE orders
SET order_number = 'ORD-' || to_char(COALESCE(order_date, CURRENT_DATE), 'YYYY')
                   || '-' || lpad(nextval('oms_order_seq')::text, 5, '0')
WHERE order_number IS NULL OR order_number = '';

-- ============================================
-- 6. AUTO-UPDATE updated_at ON ORDERS
-- ============================================
CREATE OR REPLACE FUNCTION fn_orders_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_touch_updated_at ON orders;
CREATE TRIGGER trg_orders_touch_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_orders_touch_updated_at();

-- ============================================
-- 7. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales_invoice ON orders(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_osh_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_oshipments_order ON order_shipments(order_id);
