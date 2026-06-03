-- Migration: 20260602_oms_analytics_views.sql
-- Description: Materialized views for OMS analytics, SLA breach view, and supporting indexes.
-- Safe to re-run: all statements use CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS first.

-- ============================================
-- 1. MATERIALIZED VIEW: oms_monthly_trend
--    Monthly rollup of orders with invoiced and high-risk filters
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS oms_monthly_trend;
CREATE MATERIALIZED VIEW oms_monthly_trend AS
SELECT
    date_trunc('month', order_date)                                           AS month,
    COUNT(*)::int                                                              AS total_orders,
    COALESCE(SUM(total_amount), 0)                                             AS total_amount,
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'Invoiced'), 0)         AS invoiced_amount,
    COUNT(*) FILTER (WHERE status = 'Invoiced')::int                           AS invoiced_count,
    COALESCE(SUM(total_amount) FILTER (WHERE ai_risk_level = 'High'), 0)       AS high_risk_amount,
    COUNT(*) FILTER (WHERE ai_risk_level = 'High')::int                        AS high_risk_count
FROM orders
GROUP BY date_trunc('month', order_date)
ORDER BY month DESC;

-- ============================================
-- 2. MATERIALIZED VIEW: oms_distributor_perf
--    Per-distributor performance summary
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS oms_distributor_perf;
CREATE MATERIALIZED VIEW oms_distributor_perf AS
SELECT
    distributor_id,
    distributor_name,
    COUNT(*)::int                                                    AS total_orders,
    COALESCE(SUM(total_amount), 0)                                   AS total_value,
    COALESCE(AVG(ai_risk_score), 0)                                  AS avg_risk_score,
    COUNT(*) FILTER (WHERE status IN ('Delivered', 'Invoiced'))::int AS completed_count,
    COUNT(*) FILTER (WHERE status = 'Cancelled')::int                AS cancelled_count
FROM orders
GROUP BY distributor_id, distributor_name
ORDER BY total_value DESC;

-- ============================================
-- 3. REGULAR VIEW: oms_sla_breach
--    Orders older than 7 days that are not in a terminal state
-- ============================================
CREATE OR REPLACE VIEW oms_sla_breach AS
SELECT
    o.id,
    o.order_number,
    o.distributor_id,
    o.distributor_name,
    o.status,
    o.priority,
    o.order_date,
    o.total_amount,
    (CURRENT_DATE - o.order_date)::int AS days_open,
    o.created_at
FROM orders o
WHERE o.status NOT IN ('Delivered', 'Invoiced', 'Rejected', 'Cancelled')
  AND CURRENT_DATE - o.order_date > 7
ORDER BY days_open DESC;

-- ============================================
-- 4. INDEXES on materialized views
-- ============================================
CREATE INDEX IF NOT EXISTS idx_oms_monthly_trend_month
    ON oms_monthly_trend (month DESC);

CREATE INDEX IF NOT EXISTS idx_oms_dist_perf_dist
    ON oms_distributor_perf (distributor_id);

CREATE INDEX IF NOT EXISTS idx_oms_dist_perf_value
    ON oms_distributor_perf (total_value DESC);
