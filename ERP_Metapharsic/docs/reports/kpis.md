# KPIs & Reports — Metapharsic Lifesciences ERP

## Financial KPIs

| KPI | Formula | Source |
|---|---|---|
| Revenue Growth MoM | (current_month - prev_month) / prev_month * 100 | sales_invoices |
| Gross Margin % | (revenue - cogs) / revenue * 100 | sales_invoices + purchase_invoices |
| Working Capital | current_assets - current_liabilities | general_ledger |
| Current Ratio | current_assets / current_liabilities | acc_ratios_cache |
| Quick Ratio | (current_assets - inventory) / current_liabilities | acc_ratios_cache |
| Debt-to-Equity | total_debt / total_equity | acc_ratios_cache |

Ratios stored in `acc_ratios_cache`. Refreshed on GL period close or on demand.

## Inventory KPIs

| KPI | Formula | Source |
|---|---|---|
| Inventory Turnover | COGS / avg_inventory_value | inventory_turnover_analysis |
| Days Inventory Outstanding | 365 / inventory_turnover | computed |
| Stock Accuracy | (physical_count - system_count) / system_count | batches |
| Expiry Rate | expired_qty / total_qty * 100 | batches |
| Dead Stock Value | SUM(cost_price * stock) for non-moving | dead_stock_analysis |
| FSN Fast % | fast_moving_count / total_products * 100 | abc_analysis |
| Reorder Breach Rate | products_below_reorder / total_active | products |

## Sales KPIs

| KPI | Formula | Source |
|---|---|---|
| Order Fill Rate | fulfilled_orders / total_orders * 100 | orders |
| Average Invoice Value | SUM(net_amount) / COUNT(*) | sales_invoices |
| Customer Acquisition Rate | new_customers_this_month / prev_month_total * 100 | parties |
| PCD Partner Grade Distribution | COUNT by grade (A/B/C) | pcd_partners |
| Lead Conversion Rate | converted_leads / total_leads * 100 | leads |
| Customer Drift | customers with declining order frequency Q-o-Q | orders |

## Operational KPIs

| KPI | Formula | Source |
|---|---|---|
| OMS SLA Breach Count | orders where age > sla_hours for status | orders + oms_sla_rules |
| GRN Turnaround Time | AVG(grn.created_at - po.created_at) | purchase_orders + goods_received_notes |
| 3-Way Match Success Rate | matched_pos / total_pos * 100 | three_way_matches |
| Production Yield Rate | yield_qty / planned_qty * 100 | production_orders |
| QC Pass Rate | passed_records / total_records * 100 | qc_records |

## Report Routes

All reports support:
- `?from=YYYY-MM-DD&to=YYYY-MM-DD` date range
- `?month=M&year=YYYY` month filter
- `?format=csv` for CSV export (`Content-Type: text/csv`)

Default: current month. Validate dates server-side (reject future dates for completed-status reports).

### Available Reports

| Report | Route | Data |
|---|---|---|
| Inventory Stock | GET /api/reports/inventory | Stock valuation, low-stock, expiry, FSN |
| Sales Summary | GET /api/reports/sales | Revenue, COGS, gross profit, margin %, MoM trend |
| Purchase Summary | GET /api/reports/purchase | Spend by supplier, category, MoM trend |
| GSTR-1 | GET /api/gst/gstr1 | Outward supplies by party GSTIN |
| GSTR-2 | GET /api/gst/gstr2 | Inward supplies, supports ?recon=true |
| GSTR-3B | GET /api/gst/gstr3b | Net tax payable (output - input credit) |
| Trial Balance | POST /api/accounting/trial-balance | All GL accounts with debit/credit totals |
| Balance Sheet | POST /api/accounting/balance-sheet | Assets vs Liabilities + Equity |
| P&L Statement | POST /api/accounting/profit-loss | Income vs Expenses |
| Cash Flow | POST /api/accounting/cash-flow | Operating/Investing/Financing activities |
| Aging Analysis | POST /api/accounting/aging-analysis | Debtor/Creditor aging buckets: 0-30, 31-60, 61-90, 90+ days |
| Payroll Cost Summary | GET /api/hr/payroll/cost-summary | Department-wise payroll cost for month |
| PF Register | GET /api/hr/payroll/pf-register | From hr_pf_registers |
| ESIC Register | GET /api/hr/payroll/esic-register | From hr_esic_registers |
| PT Register | GET /api/hr/payroll/pt-register | From hr_pt_registers |
| Compliance Risk Score | GET /api/compliance/risk-score | Composite 0-100 score |
