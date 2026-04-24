```text
reporting-service | APP-66666 | Add settlement export filters

Why:
Settlement exports need filter controls so operators can narrow exports to the relevant settlement window and reduce manual cleanup.

This change:
- Add filter support to settlement exports
- Keep existing export generation behavior intact for unfiltered requests
```

### Possible missing considerations
- Existing export flows may need the same filter behavior to keep operator workflows consistent.

### Possible contract risks
- Downstream automation may assume the current filterless export shape and ordering.

### Possible already-completed work
- Export metadata fields appear to already exist from the previous settlement reporting change.
