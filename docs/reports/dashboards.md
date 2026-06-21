# Dashboards — Metapharsic Lifesciences ERP

## ERP Home Dashboard

Route: `GET /api/reports/dashboard-summary`

### KPI Cards

| Card | Source Table | Query |
|---|---|---|
| Sales Today | sales_invoices | SUM(net_amount) WHERE DATE(created_at) = TODAY |
| Sales This Month | sales_invoices | SUM(net_amount) WHERE MONTH/YEAR = current |
| Purchase Today | purchase_orders | SUM(total_amount) WHERE DATE = TODAY |
| Purchase This Month | purchase_orders | SUM WHERE MONTH/YEAR = current |
| Low Stock Products | products | COUNT WHERE current_stock <= reorder_level AND is_active |
| Pending Orders | orders | COUNT WHERE status NOT IN ('Delivered','Invoiced','Cancelled') |
| Expiring Batches | batches | COUNT WHERE expiry_date <= TODAY + 30 days |

**Rules**:
- ALL queries filter `company_id = req.user.companyId || 1`
- Include `generated_at` timestamp in response
- Frontend uses `refetchInterval: 30000` (30s auto-refresh)

## Intelligence Center Dashboard

Routes under `/api/analytics/`:

| Widget | Route | Data Source |
|---|---|---|
| FSN Classification | GET /inventory/comprehensive | abc_analysis, inventory_turnover_analysis |
| ABC Analysis | GET /inventory/comprehensive | abc_analysis |
| Dead Stock | GET /inventory/comprehensive | dead_stock_analysis |
| Financial P&L Snapshot | GET /financial/summary | general_ledger (current FY) |
| Working Capital | GET /financial/summary | general_ledger |
| Customer Drift | GET /customers/drift | orders (this Q vs last Q) |
| Demand Forecast | — | forecast_demand table |
| Regional Demand | — | regional_pharmaceutical_demand |
| Financial Ratios | — | acc_ratios_cache |

**2FA required**: `GET /api/analytics/inventory/comprehensive`

## Async Report Jobs

Intelligence reports run asynchronously via PostgreSQL job queue (`report_jobs` table — PM2 cluster-safe):

```
POST /api/analytics/reports/generate
    body: { type: 'demand_forecast' | 'financial_health' | 'inventory_intelligence' }
    response: { jobId: 'dbj-1234567890', reportId: 'RPT-...' }

GET /api/analytics/reports/status/:jobId
    response: { id, state: 'active'|'completed'|'failed', progress, result }

GET /api/analytics/reports/status/batch?jobIds=id1,id2,id3
    response: { success: true, data: [{ id, state, progress, result }] }
```

**Result shape** (when completed):
```json
{
  "id": "dbj-...",
  "state": "completed",
  "result": {
    "success": true,
    "reportId": "RPT-...",
    "result": {
      "generatedAt": "...",
      "summary": "...",
      "recommendations": ["...", "..."]
    }
  }
}
```

Frontend access: `job.result.result.summary` and `job.result.result.recommendations`

## KPI Dashboard

Route: `GET /api/reports/kpi`

Source: `kpi_dashboard_data` cache table (pre-computed).

KPIs:
- Revenue growth MoM
- Gross margin %
- Inventory turnover
- Order fill rate
- Customer acquisition rate

Refresh: on demand via `POST /api/reports/ai-generate` (non-blocking via setImmediate).

## POS Dashboard

Route: `GET /api/pos/dashboard-summary`

Aggregates from `pos_bills` WHERE `session_id = current_session`.

## Deerflow Control Panel

Route: `GET /api/deerflow/workflows`

Source: `audit_logs` filtered by known DeerFlow workflow IDs + `details->>'source' = 'deerflow'`.

Displays: workflow execution history, status (IN_PROGRESS, SUCCESS, FAILED), timestamps.
