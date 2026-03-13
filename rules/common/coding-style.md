# Coding Style

## Immutability

Prefer immutability where practical — create new objects rather than mutating existing ones. Mutation is expected in ORM hooks, RPC response building, and builder patterns.

```
// Pseudocode — prefer this when possible:
update(original, field, value) → returns new copy with change

// Mutation is fine when:
// - Building ORM mutation hooks
// - Constructing RPC request/response objects
// - Using builder/functional-options patterns
```

Rationale: Immutable data prevents hidden side effects, but strict immutability is impractical in languages/frameworks that rely on mutation (ORMs, RPC builders).

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] Prefer immutable patterns (mutation OK in ORM hooks, RPC builders)
