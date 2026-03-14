---
paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Coding Style

## Formatting

- **gofmt** and **goimports** are mandatory — no style debates

## File Organization

- 200-400 lines typical, 800 max
- Organize by feature/domain, not by type

## Immutability

Prefer immutability where practical. Mutation is expected in ORM hooks, RPC response building, and builder/functional-options patterns.

## Design Principles

- Accept interfaces, return structs
- Keep interfaces small (1-3 methods)

## Error Handling

Always wrap errors with context:

```go
if err != nil {
    return fmt.Errorf("creating user: %w", err)
}
```

Use gerund form (verb+ing) for error context. Never start with "failed to" or "error":

| Wrong | Right |
|---|---|
| `"failed to create user: %w"` | `"creating user: %w"` |
| `"error fetching data: %w"` | `"fetching data: %w"` |
| `"could not connect: %w"` | `"connecting: %w"` |

## Reference

See skill: `golang-patterns` for comprehensive Go idioms and patterns.
