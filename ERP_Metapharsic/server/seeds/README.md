# Server Seed Scripts

These scripts populate the PostgreSQL database with initial/demo data for each module.
Run them **only on a fresh database** or when resetting to demo state.

> ⚠️ These scripts modify the database. Never run against production without a backup.

## Available Seeds

| Script | Module | Description |
|--------|--------|-------------|
| `seed-master.js` | Master | Core master data (companies, parties, items) |
| `seed-inventory.js` | Inventory | Stock items, batches, godowns |
| `seed-advanced-purchase.js` | Purchase | Purchase orders, GRNs, suppliers |
| `seed-purchase-intelligence.js` | Purchase Intelligence | Analytics data for purchase module |
| `seed-crm.js` | CRM | Leads, customers, follow-ups |
| `seed-compliance.js` | Compliance | Regulatory records |
| `seed-logistics.js` | Logistics | Shipments, routes, carriers |
| `seed-oms.js` | OMS | Orders, dispatch, fulfilment |
| `seed-qc.js` | Quality Control | QC tests, batches, results |
| `seed-rnd.js` | R&D | Research projects, formulations |

## Usage

Run from the `server/` directory:

```bash
node seeds/seed-master.js
node seeds/seed-inventory.js
# etc.
```

Ensure `server/.env` is configured with valid DB credentials before running.
