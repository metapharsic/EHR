# Anti-Patterns — Metapharsic Lifesciences ERP

Every entry here represents a real bug that broke this codebase.
Before implementing anything, scan this list. If your approach matches any pattern below — stop and use the documented fix instead.

---

## AP-001: In-Memory State in PM2 Cluster Mode

**What broke**: Intelligence Dashboard report jobs stuck at "Queued" forever.

**Root cause**: `report_jobs` was stored in a `Map` object inside `queueService.js`.
PM2 runs 2 workers (IDs 14 & 15). Job created on worker 14. Poll request routed to worker 15.
Worker 15's Map is empty → returns `state: 'not_found'` → UI stays "Queued".

**Anti-pattern**:
```js
// NEVER — not shared between PM2 workers
const mockJobs = new Map();
mockJobs.set(jobId, { state: 'active', ... });
```

**Fix**: Use PostgreSQL `report_jobs` table as shared queue. All workers read from the same DB.
```js
await db.query(
  `INSERT INTO report_jobs (id, report_id, type, user_id, state, progress)
   VALUES ($1, $2, $3, $4, 'active', 0) ON CONFLICT (id) DO NOTHING`,
  [jobId, reportId, type, userId]
);
```

**Rule**: Never use `Map`, `Set`, `Array`, module-level variables, or `global.*` for state shared across requests. Always use PostgreSQL.

---

## AP-002: UUID Stored in INTEGER Column

**What broke**: `POST /api/analytics/reports/generate` returned 500. No job cards appeared in UI.

**Root cause**: `report_jobs.user_id` was defined as `INTEGER`. `req.user.userId` is a UUID string (`'11111111-1111-1111-1111-111111111111'`). PostgreSQL rejected the INSERT → server returned 500 → `setActiveJobs` never called.

**Anti-pattern**:
```sql
-- NEVER define user_id as INTEGER when users.id is UUID
CREATE TABLE report_jobs (
  user_id INTEGER  -- breaks if users.id is UUID
);
```

**Fix**: Match the type of the referenced column exactly.
```sql
ALTER TABLE report_jobs ALTER COLUMN user_id TYPE TEXT;
-- or define as UUID to match users.id
```

**Rule**: Before any FK or reference column, check the PK type of the target table in `docs/database/entities.md`. `users.id` is UUID — all columns referencing it must be `UUID` or `TEXT`, never `INTEGER`.

---

## AP-003: Polling Interval Constantly Reset by Stateful useEffect

**What broke**: Intelligence Dashboard report status never polled. Reports appeared stuck even after the backend was fixed.

**Root cause**: `useEffect([activeJobs, addNotification])` — every `setActiveJobs` call inside the interval triggered a re-render, which cancelled and re-created the interval (resetting the 3-second timer). In a burst of 4 rapid report creations, the interval never fired.

**Anti-pattern**:
```js
// NEVER — deps cause interval to be recreated on every state update
useEffect(() => {
  const timer = setInterval(async () => {
    setActiveJobs(prev => [...]);  // triggers re-render → effect re-runs → interval reset
  }, 3000);
  return () => clearInterval(timer);
}, [activeJobs, addNotification]);  // ← stateful deps
```

**Fix**: Empty dependency array + `useRef` to read current state without deps.
```js
const activeJobsRef = React.useRef([]);
activeJobsRef.current = activeJobs;  // keep ref in sync on every render

useEffect(() => {
  const timer = setInterval(async () => {
    const pending = activeJobsRef.current.filter(j => j.status === 'waiting' || j.status === 'active');
    if (pending.length === 0) return;
    // ... poll API ...
    setActiveJobs(prev => prev.map(...));  // safe — doesn't retrigger effect
  }, 3000);
  return () => clearInterval(timer);
}, []);  // ← empty deps, stable interval
```

**Rule**: Never put stateful values in `useEffect` deps when those values are mutated inside the effect. Use `useRef` to read current state inside stable intervals/callbacks.

---

## AP-004: Wrong Nested Result Shape Access

**What broke**: Intelligence Dashboard showed completed reports with no summary or recommendations visible.

**Root cause**: `processReportData` returns `{ success, reportId, result: { summary, recommendations } }`.
This is stored as `job.returnvalue`. The batch endpoint returns `result: job.returnvalue`.
So the actual shape on the frontend is:
```
item.result = { success, reportId, result: { summary, recommendations } }
```
Code was accessing `job.result?.summary` (undefined). Correct path: `job.result?.result?.summary`.

**Anti-pattern**:
```jsx
// NEVER — assumes flat shape
{job.result?.summary && <p>{job.result.summary}</p>}
```

**Fix**:
```jsx
// CORRECT — matches actual nested shape
{job.result?.result?.summary && <p>{job.result.result.summary}</p>}
{job.result?.result?.recommendations?.map(...)}
```

**Rule**: Before accessing any API response field, verify the exact shape in `docs/reports/dashboards.md` (for async jobs) or test the endpoint directly. Never assume shape from variable names.

---

## AP-005: Wrong SQL Column Name

**What broke**: `GET /api/reports/dashboard-summary` always returned 500.

**Root cause**: Query used `t.amount` but `pcd_transactions` has column `order_amount`, not `amount`.

**Anti-pattern**:
```sql
-- NEVER guess column names
SELECT CASE WHEN ... THEN t.amount ELSE 0 END
```

**Fix**: Verify column names against `server/schema.sql` or `docs/database/entities.md` before writing any query.
```sql
SELECT CASE WHEN ... THEN t.order_amount ELSE 0 END
```

**Rule**: Never write a SQL query against a table without first verifying column names from schema. Use `\d table_name` on the DB or check `server/schema.sql`.

---

## AP-006: Credit Limit Check Missing in One of Three Places

**What could break**: A customer exceeds credit limit through OMS while POS and Wholesale correctly block them.

**Root cause risk**: Credit limit enforcement exists in THREE separate route files. A new route or a copy-paste that skips the check creates a bypass.

**The three mandatory check locations**:
1. `server/routes/pos.js` — POS billing
2. `server/routes/sales.js` — Wholesale sales
3. `server/routes/oms.js` — OMS order approval

**Rule**: Any new sales/invoice route MUST include:
```js
if (party.current_balance + invoiceTotal > party.credit_limit) {
  return res.status(400).json({
    error: 'Credit limit exceeded',
    limit: party.credit_limit,
    current: party.current_balance
  });
}
```
See `docs/architecture/change-propagation.md` — credit limit is a triple-enforcement point.

---

## AP-007: H1 Drug Register Not Written in Same Transaction

**What could break**: Schedule H1 drug sold but `h1_register` entry missing — regulatory violation.

**Root cause risk**: H1 register insert added as an afterthought outside the ACID transaction. If the bill commits but the H1 insert fails, you have a sold H1 drug with no legal record.

**Anti-pattern**:
```js
// NEVER — H1 insert outside transaction
await client.query('COMMIT');
if (isH1) await db.query('INSERT INTO h1_register ...');  // too late
```

**Fix**: H1 register insert MUST be inside the same `BEGIN/COMMIT` block as the bill.
```js
await client.query('BEGIN');
await client.query('INSERT INTO pos_bills ...');
if (isH1Drug) {
  await client.query('INSERT INTO h1_register ...', [drugName, batchNo, patientName, ...]);
}
await client.query('COMMIT');
```

**Rule**: Any Schedule H1 product transaction must write to `h1_register` inside the same ACID transaction. Check `products.schedule = 'H1'` before committing any bill/invoice.

---

## AP-008: DeerFlow Trigger Inside ACID Transaction

**What could break**: If DeerFlow HTTP call hangs (5s timeout), the entire DB transaction is held open — table locks, connection pool exhaustion, cascading failures.

**Anti-pattern**:
```js
// NEVER — blocking DeerFlow inside transaction
await client.query('BEGIN');
await client.query('INSERT INTO production_orders ...');
await triggerWorkflow({ workflowId: 'PRODUCTION_COMPLETE' });  // 5s timeout risk
await client.query('COMMIT');
```

**Fix**: Always use `setImmediate` — fires after transaction completes, never blocks it.
```js
await client.query('BEGIN');
await client.query('INSERT INTO production_orders ...');
await client.query('COMMIT');
setImmediate(() => triggerWorkflow({ workflowId: 'PRODUCTION_COMPLETE', moduleId: 'manufacturing', userId }));
```

**Rule**: `triggerWorkflow()` is ALWAYS `setImmediate()`. Never `await` it. Never call it inside `BEGIN/COMMIT`. See `docs/architecture/dependency-map.md`.

---

## AP-009: Hardcoded Statutory Rates

**What could break**: PF/ESIC/PT rates change by law. Hardcoded values produce wrong payslips across all employees silently.

**Anti-pattern**:
```js
// NEVER — hardcoded statutory rates
const pfRate = 0.12;
const esicRate = 0.0075;
```

**Fix**: Always read from `hr_statutory_config` table.
```js
const config = await db.query('SELECT * FROM hr_statutory_config WHERE is_active = true');
const pfRate = config.rows[0].pf_employee_rate;
```

**Rule**: PF = 12% (employee) + 13% (employer), ESIC = 0.75% (employee) + 3.25% (employer) if gross ≤ ₹21,000, PT = state-specific. All from DB, never hardcoded.

---

## AP-010: Writing Directly to general_ledger or stock_ledger_entries

**What could break**: Bypassing `ledgerHelper` skips balance updates, double-entry validation, and audit trail. Books go out of balance silently.

**Anti-pattern**:
```js
// NEVER — bypass ledgerHelper
await client.query('INSERT INTO general_ledger (account_id, debit_amount, ...) VALUES ...');
await client.query('INSERT INTO stock_ledger_entries (product_id, movement_type, ...) VALUES ...');
```

**Fix**: Always use the ledger utilities.
```js
await ledgerHelper.postToStockLedger('OUT', client, { productId, batchId, qty, movementType: 'SALE' });
await ledgerHelper.postToLedger(client, { ... });
```

**Rule**: `general_ledger` and `stock_ledger_entries` are write-protected from route handlers. Only `server/utils/ledgerHelper.js` may write to them directly. If ledgerHelper doesn't support your use case, extend ledgerHelper — don't bypass it.

---

## AP-011: Math.random() for Invoice/Record Numbers

**What could break**: Duplicate invoice numbers under concurrent load. Breaks 3-way match, audit trails, GST filing.

**Anti-pattern**:
```js
// NEVER
const invoiceNo = `INV-${Math.random().toString(36).substr(2, 9)}`;
```

**Fix**: Sequence from COUNT inside the ACID transaction.
```js
const { rows } = await client.query(
  `SELECT COUNT(*) as cnt FROM sales_invoices
   WHERE invoice_number LIKE 'INV-' || to_char(NOW(),'YYYY') || '-%'`
);
const seq = String(parseInt(rows[0].cnt) + 1).padStart(4, '0');
const invoiceNo = `INV-${new Date().getFullYear()}-${seq}`;
```

**Rule**: All invoice/PO/SO/production order numbers use deterministic sequence patterns inside ACID transactions. See invoice conventions in `docs/architecture/module-map.md`.

---

## AP-012: Modifying shared Utilities Without Checking All Callers

**What could break**: `ledgerHelper`, `hrPayrollEngine`, `deerflowClient`, `verify2FAMiddleware`, `asyncRoute` are called from 10–20+ places. A signature change, a new required parameter, or a silent behavior change breaks every caller.

**Fragile shared files** (HIGH risk — treat as system-critical):

| File | Called By |
|---|---|
| `server/utils/ledgerHelper.js` | pos.js, sales.js, purchase.js, accounting.js, vouchers.js, inventory.js, manufacturing.js |
| `server/utils/hrPayrollEngine.js` | hr.js (payroll run, TDS, overtime) |
| `server/services/deerflowClient.js` | hr.js, accounting.js, manufacturing.js, qc.js, oms.js |
| `verify2FAMiddleware` | inventory.js, accounting.js, analytics.js |
| `asyncRoute` wrapper | Every route file |

**Rule**: Before touching any file in this list — run `impact({target: "symbolName", direction: "upstream"})` in GitNexus and present the full blast radius to the user before making any change.

---

## AP-013: Soft-Delete Bypass (Hard Delete on Protected Tables)

**What could break**: Permanent data loss. Audit trail broken. Regulatory violation for drug/compliance records.

**Anti-pattern**:
```js
// NEVER on protected tables
await db.query('DELETE FROM employees WHERE id = $1', [id]);
await db.query('DELETE FROM qc_records WHERE id = $1', [id]);
await db.query('DELETE FROM audit_logs WHERE id = $1', [id]);
```

**Protected tables** (hard delete NEVER allowed):

| Table | Soft Delete Method |
|---|---|
| employees | status = 'Terminated'/'Resigned' |
| qc_records | status = 'Voided' |
| audit_logs | APPEND ONLY — no delete ever |
| financial_audit_log | APPEND ONLY — no delete ever |
| journal_vouchers | status = 'Reversed' |
| dms_documents | status = 'Deleted' |
| fixed_assets | status = 'Disposed' |
| sales_invoices | status = 'Cancelled' |
| pdc_cheques | status = 'Cleared'/'Bounced' |

See full list in `docs/database/relationships.md`.

---

## AP-014: period_locking Not Checked Before GL Write

**What could break**: Entries posted to a closed accounting period. Financial statements for prior periods change retroactively. Auditors flag material misstatement.

**Anti-pattern**:
```js
// NEVER — write to GL without period check
await ledgerHelper.postToLedger(client, { date: transactionDate, ... });
```

**Fix**: Check period lock before any GL write.
```js
const period = await client.query(
  `SELECT is_locked FROM acc_periods
   WHERE start_date <= $1 AND end_date >= $1`,
  [transactionDate]
);
if (period.rows[0]?.is_locked) {
  return res.status(400).json({ error: 'Period is locked', period: transactionDate });
}
```

**Rule**: Every route that writes to `general_ledger` must check `acc_periods.is_locked` for the transaction date before calling `ledgerHelper.postToLedger`.

---

## AP-015: camelCase / snake_case Mismatch Across the API Boundary

**What breaks**: Frontend receives `party_id` instead of `partyId`. React forms silently post `undefined`. DB receives null FK → insert fails or creates orphaned record.

**Anti-pattern**:
```js
// NEVER — send raw snake_case to frontend
res.json({ party_id: row.party_id, net_amount: row.net_amount });
```

**Fix**: Always alias in SQL.
```js
SELECT
  p.id,
  p.party_id as "partyId",
  p.net_amount as "netAmount",
  p.invoice_number as "invoiceNumber"
FROM sales_invoices p
```

**Rule**: Every SELECT query that returns data to the frontend MUST use `as "camelCaseName"` aliases for all snake_case columns. No exceptions. DB = snake_case. API JSON = camelCase.
