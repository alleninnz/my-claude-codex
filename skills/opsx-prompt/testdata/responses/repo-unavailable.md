```text
catalog-service | APP-33333 | Rename item status response field

Why:
Operators see inconsistent item status naming across catalog responses. The issue asks to align the response wording for downstream consumers.

This change:
- Rename the item status response field to match the requested terminology
- Preserve current status behavior and meaning
```

### Sanity check skipped
- Repo-based grounding was needed because the ticket names concrete fields, but repo unavailable prevented a code-backed sanity check.
