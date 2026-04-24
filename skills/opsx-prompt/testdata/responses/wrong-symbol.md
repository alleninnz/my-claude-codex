```text
orders-service | APP-22222 | Rename completed unit price field

Why:
Order responses expose the completed unit price under an inconsistent external name. Consumers need a stable field name without changing the underlying calculation.

This change:
- Rename the externally exposed completed unit price field in order responses
- Preserve the current price semantics and calculation behavior
- Limit the change to the response contract for completed unit price

Open questions:
- Confirm whether older clients still read the existing field name during rollout
```

### Ticket-vs-code mismatch
- Ticket refers to `UnitPrice`, but the externally exposed response field is `CompletedUnitPrice` in `order.proto`.
