# Approval Flows — Metapharsic Lifesciences ERP

## OMS Order State Machine

```
Pending Approval
    |
    +--[Approve]--> Approved
    |                   |
    |                   +--[Process]--> Processing
    |                   |                   |
    |                   |                   +--[Ship]--> Shipped --> Delivered --> Invoiced
    |                   |                   |
    |                   |                   +--[Hold]--> Hold
    |                   |                   |
    |                   |                   +--[Cancel]--> Cancelled
    |                   |
    |                   +--[Ship]--> Shipped
    |                   |
    |                   +--[Hold]--> Hold --> [Approve] or [Process] or [Cancel]
    |                   |
    |                   +--[Cancel]--> Cancelled
    |
    +--[Reject]--> Rejected
    |
    +--[Cancel]--> Cancelled
    |
    +--[Hold]--> Hold
```

**Stock events**:
- `Approved`: Reserve stock (FIFO across batches by expiry ASC, SELECT FOR UPDATE)
- `Shipped`: Convert reservations to physical OUT (delete reserved_stock, update batches.stock)
- `Cancelled` (after Approved/Processing): Release reservations (releaseOrderReservations)

---

## CRM Lead State Machine

```
New --> Contacted --> Qualified --> Proposal --> Negotiation --> Converted
                                                             |
                                                             +--> Lost
```

**Rules**:
- Reject invalid transitions (e.g. New -> Converted is not allowed)
- Every status change MUST write `lead_activities` row
- `Converted` triggers: create `parties` + `pcd_partners` (if pharma) in ACID transaction

---

## Journal Voucher Lifecycle

```
Draft --> Posted --> Reversed
```

**Rules**:
- Only `Posted` JVs affect the General Ledger
- `Reversed` creates equal-and-opposite JV in same ACID transaction
- Period lock (`acc_periods.is_locked = true`) blocks any GL write for that period

---

## Manufacturing Production State Machine

```
Draft --> Scheduled --> In Progress --> QC Pending --> Completed
                                                    |
                                                    +--> Cancelled
```

**Stock events**:
- `In Progress`: Deduct raw materials from `raw_materials.quantity`, write stock_ledger OUT
- `Completed`: Insert new batch (`status='QC_Pending'`), write stock_ledger IN, trigger `PRODUCTION_COMPLETE` DeerFlow

---

## BOM Version Flow

```
BOM v1.0 [Active]
    |
    +--[Edit]--> BOM v1.0 [Superseded]
                 BOM v1.1 [Active]  (new row)
```

**Rule**: Only ONE Active BOM per `product_id` at any time.

---

## QC Gate Flow

```
Purchase GRN
    |
    v
qc_records (status='Pending')  +  batches (status='QC_Pending')
    |
    +--[Pass]--> qc_records (Passed)  +  batches (status='Active')
    |                                    [stock now available]
    |
    +--[Fail]--> qc_records (Failed)  +  batches (status='Rejected', stock=0)
                                         [trigger INVENTORY_SYNC DeerFlow]
```

---

## Payroll Run Flow

```
HR Manager initiates Payroll Run (POST /api/hr/payroll/run)
    |
    v
For each employee (ACID transaction):
    computeFullPayslip() --> INSERT salary_slips (status='Draft')
    postToLedger() --> INSERT general_ledger entries
    |
    v
Salary Slip: Draft --> Approved --> Paid
    |                              |
    |                              +-- payment_vouchers entry via ledgerHelper
    |                              +-- salary_slips.payment_date = NOW()
    v
DeerFlow: PAYROLL_RUN
```

---

## Document (DMS) Approval Flow

```
Draft --> Under Review --> Approved
                      |
                      +--> Rejected
```

**Notes**:
- Version control: every edit creates new `dms_versions` row
- Soft delete only: `status='Deleted'` + `dms_audit_trail` entry
- Every action writes to `dms_audit_trail` (read, create, update, delete)

---

## Employee Lifecycle Flow

```
[Create]  --> Active
                |
                +--[Leave]--> On Leave --> Active
                |
                +--[Resign]--> Resigned (set exit_date)
                |
                +--[Terminate]--> Terminated (set exit_date)
```

**Rules**:
- Never delete employee records
- Terminated/Resigned employees still appear in historical reports
- Asset allocation must be cleared before Termination (`hr_asset_allocations`)

---

## Compliance License Alert Flow

```
drug_licenses.expiry_date
    |
    +-- > 30 days: status='valid'
    +-- 0-30 days: status='expiring' --> complianceNotificationService.sendExpiryAlerts()
    +-- Past:      status='expired'  --> complianceNotificationService.sendExpiryAlerts()
```

---

## 3-Way Match Gate (Purchase)

```
purchase_orders (PO created)
    |
    +--[GRN]--> goods_received_notes (GRN created) + qc_records (Pending)
    |
    +--[Supplier Invoice]--> supplier_invoices
    |
    v
All 3 present?
    YES --> purchase_orders.status = 'Completed'
    NO  --> flag discrepancy in three_way_matches.discrepancy
```
