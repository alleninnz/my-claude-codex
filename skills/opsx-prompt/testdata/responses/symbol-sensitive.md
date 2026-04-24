```text
pricing-service | APP-44444 | Adjust completed price field name

Why:
The completed-price contract needs a naming update so downstream readers interpret the field consistently.

This change:
- Update the completed-price response field name used by downstream consumers
- Keep the meaning of the value unchanged
- Limit the change to the named response contract
```

### Symbol-sensitive requirements
- Exact ticket ask: rename `CompletedUnitPrice` to `FinalCompletedUnitPrice` in the response contract.
