# System Architecture — Metapharsic Lifesciences ERP

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js / Express (single process, PM2 cluster) |
| Frontend | React 18 + Vite + TypeScript |
| Database | PostgreSQL 14 |
| Styling | Tailwind CSS v4 |
| State | Zustand (persist) + React Query |
| Auth | JWT (stateless) |
| Automation | DeerFlow (workflow engine) |
| AI | Internal AI agent services |
| File Storage | Local disk (`/u01/apps/Metapharsic_ERP/uploads/`) |

## Deployment

- **VPS**: 187.127.169.217 | `/u01/apps/Metapharsic_ERP`
- **Port**: 5000 (Express) -> nginx -> `erp.metapharsic.cloud`
- **PM2 Process**: `metapharsic-erp` (2 workers, IDs 14 & 15)
- **DB**: `metapharsic_erp` at `127.0.0.1:5432` / user `erp_user`
- **Frontend Build**: Vite, ~6s, ~2.5MB bundle. Run `npm run build` for every `.tsx` change.

## Repository

- Remote: `git@github.com:metapharsic/EHR.git` (branch: `master`)
- Local: `C:\ERP_3152026`
- VPS: `/u01/apps/Metapharsic_ERP`

## Key Files

| File | Purpose |
|---|---|
| `server/server.js` | Express entry point, all API routes mounted |
| `server/schema.sql` | Source of truth for PostgreSQL schema |
| `server/utils/ledgerHelper.js` | ALL stock and GL movements must go through here |
| `server/utils/hrPayrollEngine.js` | Payroll computation engine |
| `server/services/deerflowClient.js` | DeerFlow workflow trigger client |
| `src/App.tsx` | React SPA root, tab routing |
| `src/components/` | All ERP module UI components |
| `ecosystem.config.js` | PM2 configuration |

## Critical Architectural Rules

1. **PM2 Cluster Safety**: Never use in-memory Maps or Sets for shared state between workers. Use PostgreSQL for any shared job/session state.
2. **ACID Transactions**: All multi-table mutations use `db.getClient()` with `BEGIN/COMMIT/ROLLBACK`.
3. **Ledger Helper**: Never write to `stock_ledger_entries` or `general_ledger` directly from route handlers.
4. **asyncRoute Pattern**: Wrap every Express handler: `const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);`
5. **2FA**: Inventory writes and all accounting writes require `verify2FAMiddleware`. Do not remove.
6. **camelCase Translation**: DB columns are `snake_case`. Frontend JSON is `camelCase`. Backend uses SQL column aliases.
7. **Company Isolation**: Every multi-tenant query includes `WHERE company_id = $N`.
8. **Soft Deletes**: Financial records, QC records, employee records — soft delete only (`deleted_at`, `status='Deleted'`).

## DeerFlow Trigger Pattern

Always non-blocking. Never await inside an ACID transaction:

```js
setImmediate(() => triggerWorkflow({
  workflowId: 'KNOWN_WORKFLOW_ID',
  moduleId: 'module-name',
  userId: req.user.userId
}));
```

Known Workflow IDs: `EMPLOYEE_ONBOARDING_INITIATED`, `JOURNAL_VOUCHER_CREATED`, `LEAD_CONVERTED`, `INVENTORY_SYNC`, `OMS_SLA_BREACH`, `PAYROLL_RUN`, `GST_FILING_TRIGGERED`, `PRODUCTION_COMPLETE`
