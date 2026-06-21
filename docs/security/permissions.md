# Permissions Matrix — Metapharsic Lifesciences ERP

## Module Access by Role

| Module | ADMIN | FINANCE_MGR | PURCHASE_MGR | PRODUCTION_MGR | HR_MGR | SALES_MGR | INVENTORY_MGR | VIEWER |
|---|---|---|---|---|---|---|---|---|
| Dashboard | RW | R | R | R | R | R | R | R |
| CRM | RW | R | - | - | - | RW | - | R |
| PCD Network | RW | R | - | - | - | RW | - | R |
| OMS | RW | R | - | - | - | RW | R | R |
| POS / Billing | RW | R | - | - | - | RW | - | R |
| Sales Register | RW | R | - | - | - | RW | - | R |
| Wholesale Sales | RW | R | - | - | - | RW | - | R |
| Inventory Hub | RW | R | R | R | - | R | RW | R |
| Purchase | RW | R | RW | - | - | - | R | R |
| Logistics | RW | R | - | - | - | RW | R | R |
| Assets | RW | R | - | - | R | - | - | R |
| DMS | RW | R | R | R | R | R | R | R |
| Godown Master | RW | R | - | - | - | R | RW | R |
| Manufacturing | RW | R | R | RW | - | - | R | R |
| Quality Control | RW | R | - | RW | - | - | R | R |
| R&D Lab | RW | R | - | RW | - | - | - | R |
| HRMS | RW | R | - | - | RW | - | - | R |
| Finance / Accounting | RW | RW | - | - | - | - | - | R |
| GST Reports | RW | R | - | - | - | - | - | R |
| Intelligence Center | RW | R | - | - | - | R | R | R |
| Reports | RW | R | R | R | R | R | R | R |
| Audit Logs | RW | R | - | - | - | - | - | R |
| Deerflow Control | RW | - | - | - | - | - | - | R |
| Multi-Branch | RW | - | - | - | - | - | - | R |
| Settings | RW | - | - | - | - | - | - | - |
| Enterprise Hub | RW | - | - | - | - | - | - | - |

Legend: R = Read, RW = Read+Write, - = No Access

## Critical Permission Checks

### Inventory Write Routes
```js
// server/routes/inventory.js
router.post('/', authenticateToken, verify2FAMiddleware, asyncRoute(...));
router.put('/:id', authenticateToken, verify2FAMiddleware, asyncRoute(...));
router.delete('/:id', authenticateToken, verify2FAMiddleware, asyncRoute(...));
```

### Accounting Write Routes
```js
// server/routes/accounting.js
router.post('/chart-of-accounts', authenticateToken, verify2FAMiddleware, asyncRoute(...));
router.post('/journal-vouchers/:id/post', authenticateToken, verify2FAMiddleware, asyncRoute(...));
```

### Purchase Mutations
```js
// In route handler:
if (!['PURCHASE_MANAGER', 'ADMIN'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

### Payroll Run
```js
// In route handler:
if (!['ADMIN', 'HR_MANAGER'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

### Factory Reset (Settings)
```js
// Must check BOTH role AND confirm flag:
if (req.user.role !== 'ADMIN') return res.status(403)...;
if (!req.body.confirm) return res.status(400).json({ error: 'Must pass { confirm: true }' });
```

## DeerFlow Workflow Permissions

DeerFlow triggers are SYSTEM actions — not user-initiated. They run via `setImmediate()` after the main ACID transaction commits. No role check is needed on the trigger itself, but the triggering action (e.g., payroll run) requires appropriate role.

## Audit Log Write Requirements

Every user-initiated mutation MUST write to `audit_logs`:

```js
await db.query(
  `INSERT INTO audit_logs (user_id, action, module, table_name, record_id, old_value, new_value, status, ip_address, details)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
  [req.user.userId, 'VERB_NOUN', 'MODULE', 'table_name', recordId,
   JSON.stringify(oldValue), JSON.stringify(newValue), 'SUCCESS', req.ip, JSON.stringify(details)]
);
```
