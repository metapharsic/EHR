# Change Propagation Matrix — Metapharsic Lifesciences ERP

When you change X, you MUST also update everything listed under it.
This is the "what else breaks" map. Run GitNexus impact analysis AND check this file before every edit.

---

## Database Changes

### If you ADD a column to any table:

- [ ] Update `server/schema.sql` (source of truth)
- [ ] Write a migration: `ALTER TABLE ... ADD COLUMN ...`
- [ ] Add default value for existing rows (never leave existing rows in invalid state)
- [ ] Update all SELECT queries in the relevant route file to include the new column with camelCase alias
- [ ] Update `docs/database/entities.md` with the new column
- [ ] If the column is a FK — update `docs/database/relationships.md`
- [ ] If the column is displayed in UI — update the TypeScript interface/type in frontend

### If you RENAME a column:

- [ ] Write migration: `ALTER TABLE ... RENAME COLUMN old TO new`
- [ ] Find EVERY SELECT, INSERT, UPDATE, WHERE that references the old name (use Grep — not just in one file)
- [ ] Update all SQL aliases (`old_name as "camelCase"` → `new_name as "camelCase"`)
- [ ] Update `server/schema.sql`
- [ ] Update `docs/database/entities.md`
- [ ] Check `docs/database/relationships.md` for FK references

### If you DROP a column:

- [ ] Verify no SELECT, INSERT, WHERE references it (Grep the entire codebase)
- [ ] Write migration with rollback plan
- [ ] Update `server/schema.sql`
- [ ] Update `docs/database/entities.md`
- [ ] Update `docs/database/relationships.md` if it was a FK
- [ ] Check `docs/reports/kpis.md` — if it feeds a KPI, update that too

### If you CHANGE a column TYPE:

- [ ] Check every value currently stored — will the cast succeed for all existing rows?
- [ ] Write migration with `USING` clause for explicit cast
- [ ] Verify all application-side bindings match the new type (especially UUID vs INTEGER — see AP-002)
- [ ] Write rollback migration before applying forward migration

### If you CREATE a new table:

- [ ] Verify entity doesn't already exist (check `docs/database/entities.md` first)
- [ ] Include all mandatory columns: `id`, `created_at`, `updated_at`, `company_id`, soft delete field
- [ ] Add to `docs/database/entities.md`
- [ ] Add all FKs to `docs/database/relationships.md`
- [ ] Add to `docs/database/erd.md` under the correct domain cluster
- [ ] If it stores user actions — include `created_by UUID` referencing `users.id`

---

## API / Route Changes

### If you CHANGE an API response shape:

- [ ] Find every frontend component that calls this endpoint (`apiClient.get/post` — Grep the endpoint path)
- [ ] Update every field access in those components to match the new shape
- [ ] If it's an async job result — update `docs/reports/dashboards.md` with new shape
- [ ] If a field is renamed — update all destructuring, optional chaining, and conditional renders
- [ ] Check `useDataFetch` calls — they auto-unwrap `{ success, data }` → the `data` field only

### If you ADD a new required field to a POST body:

- [ ] Find every frontend form that calls this endpoint
- [ ] Add the field to the form state, validation, and submit payload
- [ ] Add server-side validation (return 400 if missing)
- [ ] Update any existing seed data or test fixtures

### If you RENAME a route path:

- [ ] Find every `apiClient.get/post/put/delete` call with the old path (Grep)
- [ ] Update all frontend API calls
- [ ] Update `docs/architecture/module-map.md`
- [ ] Check if the old path is referenced in any NGINX config or external integration

### If you CHANGE an HTTP method (GET → POST etc.):

- [ ] Update all frontend calls
- [ ] Update any API documentation
- [ ] Verify auth middleware still applies (some middleware chains are method-specific)

---

## State Machine Changes

### If you ADD a new state to any status machine:

- [ ] Add the new state to the validation switch/if block in the route handler
- [ ] Add the allowed transitions TO this state (from which states can it be reached?)
- [ ] Add the allowed transitions FROM this state (where can it go?)
- [ ] Add stock/ledger/audit side effects if applicable (see `docs/workflows/approval-flow.md`)
- [ ] Add the new state to the frontend status badge color mapping
- [ ] Add the new state to any filter dropdowns that list statuses
- [ ] Update `docs/workflows/approval-flow.md`

### If you CHANGE a state transition rule:

- [ ] Verify no existing production data is in a state that would become orphaned
- [ ] Update the transition validation in the route handler
- [ ] Update `docs/workflows/approval-flow.md`
- [ ] Check if the transition triggers stock reservation/release — update side effects if so

### If you REMOVE a state:

- [ ] Verify no existing production rows have that status (query the DB first)
- [ ] Write a migration to move those rows to a valid replacement state
- [ ] Remove from all frontend dropdowns, badge maps, filter options
- [ ] Update `docs/workflows/approval-flow.md`

---

## Shared Utility Changes

### If you change `server/utils/ledgerHelper.js`:

**Callers**: pos.js, sales.js, purchase.js, accounting.js, vouchers.js, inventory.js, manufacturing.js, hr.js

- [ ] Run `impact({target: "ledgerHelper", direction: "upstream"})` — review ALL callers
- [ ] If adding a required parameter → update every caller
- [ ] If changing return value → update every place that reads the return value
- [ ] Test: POS bill, wholesale invoice, GRN receive, journal voucher post, payroll run — all use ledgerHelper

### If you change `server/utils/hrPayrollEngine.js`:

**Callers**: hr.js (payroll run, TDS compute, overtime pay, bulk process)

- [ ] Run impact analysis
- [ ] Test full payroll run for one employee end-to-end
- [ ] Verify `salary_slips` record created correctly
- [ ] Verify GL entries written via ledgerHelper

### If you change `server/services/deerflowClient.js`:

**Callers**: hr.js, accounting.js, manufacturing.js, qc.js, oms.js

- [ ] Run impact analysis
- [ ] Verify timeout handling still returns gracefully (never propagate DeerFlow errors to API caller)
- [ ] Verify `audit_logs` entry still written before HTTP call

### If you change authentication middleware (`authenticateToken`, `verify2FAMiddleware`):

- [ ] Run impact analysis — these are applied on every protected route
- [ ] `verify2FAMiddleware` MUST remain on all inventory and accounting write routes — do not remove
- [ ] Test login → protected route → 2FA-required route end-to-end

### If you change `asyncRoute` wrapper:

- [ ] This wraps EVERY route handler. A bug here brings down the entire API.
- [ ] Test: 200 response, 400 validation error, 500 uncaught error — all must propagate correctly

---

## Frontend Component Changes

### If you change a shared component (ERPLayout, Sidebar, TopNav):

- [ ] These render on EVERY page. Test at least 5 different module tabs after change.
- [ ] Check mobile layout (responsive breakpoints)
- [ ] Verify Zustand persist state still works (`sidebarCollapsed`, `activeCompanyId`)

### If you change `useDataFetch` hook:

- [ ] This is used by nearly every data-loading component
- [ ] Verify it still unwraps `{ success, data }` correctly
- [ ] Verify `isLoading`, `error`, `data` states are correct in all three cases

### If you change a Zustand store:

- [ ] Find all components that subscribe to the changed slice (`useAppStore(state => state.X)`)
- [ ] If you rename a persisted key — existing users' persisted state in localStorage will be stale
- [ ] Add migration logic or clear the store on version mismatch

---

## GST Engine Changes

The GST engine logic exists in THREE places. Change all three or change none:

1. `server/routes/pos.js` — POS billing
2. `server/routes/sales.js` — Wholesale/PCD invoices
3. `server/routes/accounting.js` — Journal vouchers with GST

### If you change GST calculation logic:

- [ ] Update all three files above
- [ ] Verify `tax_configurations` table is the source for rates (never hardcode)
- [ ] Test: intra-state (CGST+SGST) and inter-state (IGST) scenarios
- [ ] Verify GSTR-1 and GSTR-3B reports still produce correct totals

---

## Security Changes

### If you add a new write route:

- [ ] Add `authenticateToken` middleware
- [ ] Add role guard if the operation is restricted (purchase, payroll, accounting writes)
- [ ] If it's an inventory or accounting write — add `verify2FAMiddleware`
- [ ] Add `audit_logs` INSERT at the end of the handler
- [ ] Add company isolation (`WHERE company_id = $N`)
- [ ] Add to `docs/security/permissions.md` module access matrix

### If you add a new table with sensitive data:

- [ ] Add company_id isolation
- [ ] Add to soft-delete list in `docs/database/relationships.md` if applicable
- [ ] Ensure it's not exposed via a GET-all route without auth
- [ ] If it contains PII (patient names, employee data) — document in `docs/security/roles.md`

---

## Credit Limit — Triple Enforcement Point

Credit limit check exists in 3 route files. ANY new sales flow must add it:

```js
const party = await client.query('SELECT current_balance, credit_limit FROM parties WHERE id=$1', [partyId]);
if (party.rows[0].current_balance + invoiceTotal > party.rows[0].credit_limit) {
  return res.status(400).json({ error: 'Credit limit exceeded', limit: party.rows[0].credit_limit });
}
```

Files that already have this check:
1. `server/routes/pos.js`
2. `server/routes/sales.js`
3. `server/routes/oms.js`

If you add a 4th sales route — add it there too.

---

## PM2 Cluster Safety Checklist

Before using ANY of these patterns, stop and use PostgreSQL instead:

| Unsafe Pattern | Safe Alternative |
|---|---|
| `const cache = new Map()` at module level | `SELECT` from a DB table |
| `global.someState = value` | Insert into DB |
| `process.env.RUNTIME_STATE = x` | Store in DB / erp_settings |
| Module-level `let jobCount = 0` | DB sequence or COUNT |
| `setTimeout` for deferred state | DB job with polling |

**Why**: PM2 runs 2 workers. Module-level state is per-worker. Requests are load-balanced. State created on worker 14 is invisible to worker 15. See AP-001.

---

## Documentation Update Rules

When any implementation change is made, these docs must stay in sync:

| Code Change | Docs to Update |
|---|---|
| New table | entities.md, relationships.md, erd.md |
| New route | module-map.md |
| Changed API shape | dashboards.md (if async job), module-map.md |
| New state in state machine | approval-flow.md (or sales-flow.md / inventory-flow.md) |
| New role or permission | roles.md, permissions.md |
| New KPI or report | kpis.md |
| New cross-module dependency | dependency-map.md |
| New known bug/fix | anti-patterns.md |
