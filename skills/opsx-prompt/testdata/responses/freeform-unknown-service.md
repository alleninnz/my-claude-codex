```text
unknown-service | no-issue | Add CSV export for failed records

Why:
Operators need a simple way to export failed records for manual follow-up instead of copying data row by row.

This change:
- Let operators export failed records as CSV
- Include enough context in the export to support manual follow-up
- Keep the change focused on export behavior rather than broader retry workflow changes
```
