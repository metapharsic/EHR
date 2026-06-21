# Inventory Flows — Metapharsic Lifesciences ERP

## Stock IN Flow (Purchase Receipt / GRN)

```
POST /api/purchase/:id/receive
    |
    v
ACID Transaction:
    INSERT goods_received_notes
    INSERT grn_items
    UPDATE purchase_orders.status = 'Received'
    ledgerHelper.postToStockLedger('IN'):
        UPDATE batches.stock (increase)
        INSERT stock_ledger_entries (movement_type='GRN')
    INSERT qc_records (status='Pending')  --> batches.status = 'QC_Pending'
    COMMIT
    |
    v
QC Review (separate flow):
    PASS --> batches.status = 'Active'  [stock now available]
    FAIL --> batches.status = 'Rejected', batches.stock = 0
```

## Stock OUT Flow (OMS Shipment)

```
OMS Order: Pending Approval --> Approved
    |
    v
Stock Reservation (ACID):
    FIFO SELECT from batches WHERE product_id = $id
         ORDER BY expiry_date ASC
         FOR UPDATE
    INSERT reserved_stock (order_id, batch_id, qty)
    UPDATE batches.reserved_qty (increase)
    COMMIT
    |
    v
OMS Order: Approved --> Shipped
    |
    v
Stock Deduction (ACID):
    ledgerHelper.postToStockLedger('OUT')
    UPDATE batches.stock (decrease)
    DELETE FROM reserved_stock WHERE order_id = $id
    INSERT stock_ledger_entries (movement_type='SALE')
    COMMIT
```

## Stock Adjustment Flow

```
POST /api/inventory/adjust
    |
    v
ACID Transaction:
    UPDATE batches.stock (increase or decrease)
    INSERT stock_ledger_entries (movement_type='Adjustment', reason_id=$reason)
    COMMIT
```

## Expiry Rules

- `EXPIRING`: `expiry_date <= CURRENT_DATE + 30 days` → flag on every read
- `EXPIRED`: `expiry_date < CURRENT_DATE` → flag, NEVER dispatch
- Block: POS and OMS must check expiry before adding to bill/order

## FSN Classification

```
velocity = units_sold_90_days / 90

Fast Moving:    velocity > 0.1
Slow Moving:    velocity > 0
Non-Moving:     velocity = 0
```

Stored in `abc_classification`. Used for dead stock analysis and reorder prioritization.

## Valuation Method

- FIFO: `SUM(batches.cost_price * batches.stock)` per product
- `GET /api/inventory/valuation` — never pre-aggregate; compute live

## Reorder Alert

```
GET /api/purchase/reorder-alerts
    |
    v
SELECT * FROM products
WHERE current_stock <= reorder_level
AND is_active = true
```
