# Server Admin & Setup Scripts

These are **one-time** or **on-demand** operational scripts for database setup, admin user management, and data migrations.

> ⚠️ These scripts directly modify the database. Always take a backup before running. **Never run against production without explicit intent.**

## Available Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup-admin.js` | Create initial admin user and roles | Fresh database setup |
| `reset-admin-fix.js` | Reset admin password to `admin` | Emergency admin lockout recovery |
| `migrate-auth.js` | Apply authentication schema changes | After auth schema updates |
| `migrate_products.js` | Migrate products table schema | After products schema changes |
| `demo-accounting-data.js` | Load accounting demo data | Demo/testing environments |

## Usage

Run from the `server/` directory:

```bash
node scripts/setup-admin.js
node scripts/reset-admin-fix.js
# etc.
```

Ensure `server/.env` is configured with valid DB credentials before running.
