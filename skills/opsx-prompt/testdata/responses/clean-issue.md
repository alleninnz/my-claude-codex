```text
billing-service | APP-12345 | Backfill invoice totals

Why:
Historical invoices are missing rolled-up totals in reporting. Finance and support need consistent totals without manual recomputation.

This change:
- Backfill invoice totals for existing records that are missing them
- Ensure newly generated invoice exports include the corrected totals
- Keep the scope limited to invoice total calculation and reporting correctness

Already in place:
- The storage fields for invoice totals already exist from prior reporting work

Non-scope:
- Do not change invoice pricing rules
```
