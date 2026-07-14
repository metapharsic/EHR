-- Migration: 20260602_oms_returns.sql
-- Description: Creates order_returns and order_return_items tables,
--              return number sequence, and auto-assignment trigger.
-- Safe to re-run: all statements use IF NOT EXISTS / CREATE OR REPLACE.

-- ============================================
-- 1. order_returns TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_returns (
    id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id         UUID         NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    return_number    VARCHAR(50)  UNIQUE,
    return_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
    reason           TEXT,
    status           VARCHAR(30)  NOT NULL DEFAULT 'Pending'
                                  CHECK (status IN ('Pending', 'Approved', 'Restocked', 'Credit Issued')),
    credit_note_id   UUID         REFERENCES sales_invoices(id) ON DELETE SET NULL,
    created_by       UUID         REFERENCES users(id),
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. order_return_items TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_return_items (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id      UUID          NOT NULL REFERENCES order_returns(id) ON DELETE CASCADE,
    order_item_id  UUID          REFERENCES order_items(id),
    product_id     UUID          REFERENCES products(id),
    product_name   VARCHAR(255),
    quantity       INTEGER       NOT NULL,
    rate           NUMERIC(15,2),
    amount         NUMERIC(15,2),
    reason         VARCHAR(255),
    condition      VARCHAR(50)   NOT NULL DEFAULT 'Good'
                                 CHECK (condition IN ('Good', 'Damaged', 'Expired')),
    restock        BOOLEAN       NOT NULL DEFAULT TRUE,
    batch_id       UUID          REFERENCES batches(id) ON DELETE SET NULL
);

-- ============================================
-- 3. SEQUENCE: oms_return_seq
-- ============================================
CREATE SEQUENCE IF NOT EXISTS oms_return_seq START 1;

-- ============================================
-- 4. TRIGGER FUNCTION: fn_assign_return_number
-- ============================================
CREATE OR REPLACE FUNCTION fn_assign_return_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
        NEW.return_number := 'RET-' || to_char(COALESCE(NEW.return_date, CURRENT_DATE), 'YYYY')
                             || '-' || lpad(nextval('oms_return_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_return_number ON order_returns;
CREATE TRIGGER trg_assign_return_number
BEFORE INSERT ON order_returns
FOR EACH ROW
EXECUTE FUNCTION fn_assign_return_number();

-- ============================================
-- 5. AUTO-UPDATE updated_at ON order_returns
-- ============================================
CREATE OR REPLACE FUNCTION fn_order_returns_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_returns_touch_updated_at ON order_returns;
CREATE TRIGGER trg_order_returns_touch_updated_at
BEFORE UPDATE ON order_returns
FOR EACH ROW
EXECUTE FUNCTION fn_order_returns_touch_updated_at();

-- ============================================
-- 6. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_order_returns_order_id
    ON order_returns (order_id);

CREATE INDEX IF NOT EXISTS idx_order_returns_status
    ON order_returns (status);

CREATE INDEX IF NOT EXISTS idx_order_return_items_return_id
    ON order_return_items (return_id);

CREATE INDEX IF NOT EXISTS idx_order_return_items_product
    ON order_return_items (product_id);
