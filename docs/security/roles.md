# Roles & Permissions — Metapharsic Lifesciences ERP

## Role Hierarchy

| Role | Access Level |
|---|---|
| ADMIN | Full access to all modules, settings, factory reset |
| FINANCE_MANAGER | Accounting writes, journal posting, financial reports |
| ACCOUNTANT | Read accounting, draft JVs (cannot post) |
| PURCHASE_MANAGER | Purchase order mutations, GRN, vendor ratings |
| PRODUCTION_MANAGER | BOM create/edit/delete, production order status changes |
| HR_MANAGER | HR CRUD, payroll run, statutory reports |
| SALES_MANAGER | CRM, OMS, POS, wholesale sales |
| INVENTORY_MANAGER | Inventory adjustments, batch management |
| VIEWER | Read-only across permitted modules |

## Route-Level Guards

| Route Group | Required Role |
|---|---|
| `PUT/POST/DELETE /api/purchase/...` | PURCHASE_MANAGER or ADMIN |
| `POST /api/manufacturing/bom` (create/edit/delete) | PRODUCTION_MANAGER or ADMIN |
| `POST /api/hr/payroll/run` | ADMIN or HR_MANAGER |
| `POST/PUT /api/accounting/chart-of-accounts` | ADMIN or FINANCE_MANAGER or ACCOUNTANT |
| `POST /api/accounting/journal-vouchers/:id/post` | ADMIN or FINANCE_MANAGER |
| `POST /api/settings/reset` | ADMIN only (requires `{ confirm: true }`) |
| `GET /api/analytics/inventory/comprehensive` | Any authenticated user + 2FA |

## 2FA (Two-Factor Authentication) Requirements

2FA middleware (`verify2FAMiddleware`) is MANDATORY on:

- ALL write routes in `server/routes/inventory.js` (POST, PUT, DELETE)
- ALL write routes in `server/routes/accounting.js`
- `GET /api/analytics/inventory/comprehensive`

**Never remove `verify2FAMiddleware` from these routes.**

Global setting: `erp_settings.security.twoFactorRequired = true` makes 2FA mandatory for ALL write routes.

## Field-Level Security

| Field | Restriction |
|---|---|
| `users.password` | Never expose in API responses (not even hashed) |
| `api_keys.key` | Never expose in logs or error messages |
| `erp_settings.GMAIL_APP_PASSWORD` | Excluded from settings export |
| `erp_settings.JWT_SECRET` | Excluded from settings export |
| `parties.credit_limit` | SALES_MANAGER read, FINANCE_MANAGER write |

## Record-Level Security

- **Company Isolation**: Every query for multi-tenant tables MUST include `WHERE company_id = $N`. Cross-company data leakage is a critical bug.
- **User Scoping**: `leads`, `employees`, HR records are scoped by `company_id` only (not user-level row security).
- **Audit Immutability**: `audit_logs` and `financial_audit_log` are append-only. Never allow UPDATE or DELETE.

## Authentication

- JWT stateless authentication
- `req.user.userId` = UUID of authenticated user
- `req.user.companyId` = company ID (defaults to 1 if not set)
- `req.user.role` = role string
- Token expiry: configured via `erp_settings.security.sessionTimeout`
- Max login attempts: configured via `erp_settings.security.maxLoginAttempts`

## OWASP Checklist

Before any implementation:

- [ ] Input validation on all user-supplied parameters
- [ ] SQL injection prevention (parameterized queries only — never string concatenation)
- [ ] Output encoding (React escapes by default — do not use `dangerouslySetInnerHTML`)
- [ ] Sort/filter fields whitelist on server (logistics.js pattern)
- [ ] File upload: validate type + size (DMS: 50MB, Compliance: 10MB)
- [ ] Sensitive data never logged or exposed in error messages
- [ ] HTTPS enforced via `httpsRedirect` middleware (already in server.js)
