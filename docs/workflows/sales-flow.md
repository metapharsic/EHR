# Sales Flows — Metapharsic Lifesciences ERP

## POS Billing Flow

```
Customer arrives at counter
    |
    v
Open POS Session (pos_sessions)
    |
    v
Select products --> check batches.available_qty (stock - reserved_qty)
    |
    v
Apply GST:
    company.state == party.state --> CGST + SGST (50/50)
    company.state != party.state --> IGST
    |
    v
Check credit limit:
    parties.current_balance + bill_total > parties.credit_limit --> 400 error
    |
    v
ACID Transaction:
    INSERT pos_bills
    INSERT pos_bill_items
    For each item:
        SELECT batches FOR UPDATE (concurrency lock)
        UPDATE batches.stock (deduct)
        INSERT stock_ledger_entries (OUT via ledgerHelper)
        IF product.schedule = 'H1':
            INSERT h1_register (MANDATORY)
    INSERT pos_payments
    postToLedger() --> INSERT general_ledger
    UPDATE parties.current_balance
    COMMIT
```

## Wholesale Sales Flow

```
Create Invoice (WHO-YYYYMMDD-NNNN)
    |
    v
Validate party (type IN ('Debtor','Both'))
    |
    v
Per-item GST: taxable = qty * rate; gst = taxable * gst_percent / 100
    |
    v
Credit limit check
    |
    v
ACID Transaction:
    INSERT sales_invoices
    INSERT sales_invoice_items
    ledgerHelper.postToStockLedger('OUT') --> INSERT stock_ledger_entries
    postToLedger() --> INSERT general_ledger
    UPDATE parties.current_balance
    COMMIT
```

## PCD Invoice Flow

Invoice prefix: `PCD-YYYYMMDD-NNNN`

Same flow as Wholesale but filtered/displayed in PCD module.
Partner grade updates triggered quarterly via `pcd_schemes` evaluation.

## Return Flow (Credit Note)

```
POST /api/pos/returns OR /api/vouchers/sales-return
    |
    v
ACID Transaction:
    CREATE CreditNote in sales_invoices (negative net_amount)
    ledgerHelper.postToStockLedger('IN') --> restore batch stock
    INSERT stock_ledger_entries (IN)
    Reverse GL entries via ledgerHelper
    UPDATE parties.current_balance (decrease)
    COMMIT
```
