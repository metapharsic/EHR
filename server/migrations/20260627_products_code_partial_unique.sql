-- 20260627_products_code_partial_unique.sql
-- Fix: SKU not saving (POST /api/inventory -> 500 "duplicate key ... products_code_key").
--
-- The route enforces code uniqueness only among ACTIVE products
-- (SELECT ... WHERE code = $1 AND deleted_at IS NULL), but the table had a
-- GLOBAL unique constraint products_code_key (code) that also counted
-- soft-deleted rows. Re-adding a code that belonged to a soft-deleted product
-- passed the route's check, then violated the global constraint -> 500.
--
-- Replace the global constraint with a partial unique index scoped to
-- non-deleted rows so deleted codes can be reused. Non-destructive.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS products_code_active_key
  ON products (code)
  WHERE deleted_at IS NULL;
