<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **EHR** (5012 symbols, 11544 relationships, 272 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/EHR/context` | Codebase overview, check index freshness |
| `gitnexus://repo/EHR/clusters` | All functional areas |
| `gitnexus://repo/EHR/processes` | All execution flows |
| `gitnexus://repo/EHR/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

---

# Documentation Structure

This project uses a `/docs/` directory for detailed artifacts. Always read relevant docs before coding:

| Document | Read For |
|---|---|
| `/docs/architecture/system-architecture.md` | Stack, deployment, critical rules, DeerFlow pattern |
| `/docs/architecture/module-map.md` | All 26 modules, route inventory, invoice number conventions |
| `/docs/architecture/dependency-map.md` | Cross-module dependencies, shared utilities, GST engine rules |
| `/docs/database/entities.md` | All DB tables, column requirements, mandatory fields |
| `/docs/database/relationships.md` | All FK relationships, soft-delete patterns, key invariants |
| `/docs/database/erd.md` | Domain cluster diagrams, cross-domain bridges |
| `/docs/workflows/approval-flow.md` | OMS, CRM, JV, Manufacturing, QC, Payroll, DMS state machines |
| `/docs/workflows/sales-flow.md` | POS, wholesale, PCD, return credit note flows |
| `/docs/workflows/inventory-flow.md` | Stock IN/OUT, adjustment, expiry, FSN, valuation flows |
| `/docs/security/roles.md` | Role hierarchy, route guards, 2FA requirements, OWASP checklist |
| `/docs/security/permissions.md` | Module access matrix, field-level security, audit write requirements |
| `/docs/reports/dashboards.md` | Dashboard widgets, async report jobs, result shape |
| `/docs/reports/kpis.md` | All KPIs, formulas, source tables, report routes |
| `/docs/architecture/change-propagation.md` | "If you touch X, update Y" — full propagation matrix |
| `/docs/known-issues/anti-patterns.md` | 15 real bugs from this codebase — patterns to never repeat |

If documentation and code conflict, report the conflict before implementing.

---

# Zero-Omission Protocol — GitNexus Workflow Integration

Every GitNexus session on this project MUST follow this sequence before writing any code:

## Pre-Implementation Checklist (run in order)

```
1.  Read /docs/known-issues/anti-patterns.md        → confirm approach is not a known failure pattern
2.  Read /docs/architecture/module-map.md           → verify module + route already exists
3.  Read /docs/database/entities.md                 → verify entity already exists
4.  Read /docs/database/relationships.md            → verify relationship already exists
5.  Read /docs/architecture/dependency-map.md       → map cross-module impact
6.  Read /docs/architecture/change-propagation.md  → build full propagation checklist for this change type
7.  Read /docs/security/permissions.md              → verify security requirements
8.  gitnexus_query("full module inventory")         → find symbols in live code
9.  impact({target: "<symbol>", direction: "upstream"}) → blast radius for the target
10. gitnexus_query("<feature area> workflow")       → trace existing process flows
11. gitnexus_context({name: "<symbol>"})            → callers + callees + processes
```

Only after steps 1–11 are complete may implementation begin.

## Cross-Module Impact Query Pattern

Before any change, run these queries to satisfy RULE 9 (Cross-Module Impact):

```
gitnexus_query("security permissions <module>")
gitnexus_query("audit logging <module>")
gitnexus_query("notifications <module>")
gitnexus_query("reports dashboards <module>")
gitnexus_query("integrations <module>")
```

## Completeness Score via GitNexus

After implementation, verify coverage using:

```
detect_changes()                                    → confirm only expected symbols changed
gitnexus_query("test coverage <feature>")          → check test gaps
gitnexus_query("permissions roles <feature>")      → check security gaps
```

## Risk Thresholds

| GitNexus Risk Level | Action Required |
|---|---|
| LOW | Proceed after standard impact check |
| MEDIUM | Document affected callers; notify user |
| HIGH | Stop. Present full blast radius. Get explicit approval. |
| CRITICAL | Stop. Do not proceed. Escalate to user. |

## Metapharsic ERP — Module Registry

All known modules for dependency mapping (RULE 1):

| Module | Tab Enum | Key Tables |
|---|---|---|
| Dashboard | DASHBOARD | sales_invoices, purchase_orders, products |
| CRM | CRM | leads, lead_activities, crm_opportunities |
| PCD Network | PCD_NETWORK | pcd_partners, pcd_transactions, pcd_schemes |
| OMS | OMS | orders, order_items, reserved_stock |
| POS / Billing | POS | pos_bills, pos_sessions, pos_payments |
| Sales Register | SALES_REGISTER | sales_invoices, invoice_items |
| Wholesale Sales | WHOLESALE_SALES | sales_invoices, parties |
| Inventory Hub | INVENTORY | products, batches, stock_ledger |
| Purchase | PURCHASE | purchase_orders, purchase_invoices |
| Logistics | LOGISTICS | order_shipments, logistics_partners |
| Assets & Maintenance | ASSETS | assets, asset_maintenance |
| Documents (DMS) | DMS | dms_documents, dms_folders |
| Godown Master | GODOWN_MASTER | godowns, godown_stock |
| Manufacturing | MANUFACTURING | production_orders, bom_master |
| Quality Control | QC | qc_reports, quality_checks |
| R&D Lab | RD_LAB | rd_projects, rd_experiments |
| Employees / HR | EMPLOYEES | employees, attendance, payroll |
| Finance / Accounting | ACCOUNTS | general_ledger, chart_of_accounts |
| GST Reports | GST_REPORTS | sales_invoices, purchase_invoices |
| Intelligence Center | INTELLIGENCE_DASHBOARD | abc_analysis, forecast_demand |
| Reports | REPORTS | report_jobs, kpi_dashboard_data |
| Audit Logs | AUDIT_LOGS | audit_logs, financial_audit_log |
| Deerflow Control | DEERFLOW_DASHBOARD | audit_logs (deerflow entries) |
| Multi-Branch | MULTI_BRANCH | branches |
| Settings | SETTINGS | erp_settings, users, financial_years |
| Enterprise Hub | ENTERPRISE_HUB | api_keys, integrations |

Use this registry to satisfy RULE 1 (Full Codebase Discovery) without needing to re-scan every session.
