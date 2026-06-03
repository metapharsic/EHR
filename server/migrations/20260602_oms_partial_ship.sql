-- Migration: 20260602_oms_partial_ship.sql
-- Description: Adds partial dispatch support — new columns on orders and order_shipments,
--              order_shipment_items table, shipment number sequence and trigger.
-- Safe to re-run: all statements use IF NOT EXISTS / CREATE OR REPLACE.

-- ============================================
-- 1. ADD COLUMNS TO orders
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_shipped_value NUMERIC(15,2) DEFAULT 0;

-- ============================================
-- 2. ADD COLUMNS TO order_shipments
-- ============================================
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS shipment_number VARCHAR(50);
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS total_value    NUMERIC(15,2) DEFAULT 0;

-- ============================================
-- 3. order_shipment_items TABLE
--    Tracks exactly which items (and quantities) were in each dispatch
-- ============================================
CREATE TABLE IF NOT EXISTS order_shipment_items (
    id               UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id      UUID     NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
    order_item_id    UUID     REFERENCES order_items(id),
    product_id       UUID     REFERENCES products(id),
    product_name     VARCHAR(255),
    batch_id         UUID     REFERENCES batches(id) ON DELETE SET NULL,
    quantity_shipped INTEGER  NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. NOTE: 'Partially Shipped' is a valid status value for the orders.status
--    VARCHAR column. No enum alteration is required.
-- ============================================

-- ============================================
-- 5. SEQUENCE: oms_shipment_seq
-- ============================================
CREATE SEQUENCE IF NOT EXISTS oms_shipment_seq START 1;

-- ============================================
-- 6. TRIGGER FUNCTION: fn_assign_shipment_number
-- ============================================
CREATE OR REPLACE FUNCTION fn_assign_shipment_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.shipment_number IS NULL OR NEW.shipment_number = '' THEN
        NEW.shipment_number := 'SHIP-' || to_char(CURRENT_DATE, 'YYYY')
                              || '-' || lpad(nextval('oms_shipment_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_shipment_number ON order_shipments;
CREATE TRIGGER trg_assign_shipment_number
BEFORE INSERT ON order_shipments
FOR EACH ROW
EXECUTE FUNCTION fn_assign_shipment_number();

-- ============================================
-- 7. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_osi_shipment_id
    ON order_shipment_items (shipment_id);

CREATE INDEX IF NOT EXISTS idx_osi_order_item_id
    ON order_shipment_items (order_item_id);

CREATE INDEX IF NOT EXISTS idx_order_shipments_number
    ON order_shipments (shipment_number);
