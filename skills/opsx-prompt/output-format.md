# Output Format — Generated Prompt Structure

## Template

```
<service> | <issue-id or "no-issue"> | <short description>

<Why — 1-2 sentences: business problem, why now, what breaks if we don't>

<Already in place — existing infrastructure this change builds on. Omit if nothing pre-exists.>

This change:
- <functionality point from the issue>
- ...
- <discovered functionality — marked with (discovered)>

<Breaking changes + Expand/Migrate/Contract phase — omit if no breaking changes>

<Non-scope — what this change explicitly does NOT cover. Omit if not known.>
```

All sections except the title line and "This change" are conditional — omit if not applicable.
