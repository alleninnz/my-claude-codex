# Errors

Version-gated APIs in this file require the module's `go.mod` `go` directive to be at or above the version shown in the heading.

## Error Handling

**Wrap with context — always use `%w` unless deliberately hiding internals:**

```go
// Good: callers can unwrap
return fmt.Errorf("get user %q: %w", id, err)

// Opaque: callers cannot unwrap (use at API boundaries)
return fmt.Errorf("get user %q: %v", id, err)
```

**Multiple causes (1.20+):**

```go
err := fmt.Errorf("op failed: %w and %w", err1, err2)
err := errors.Join(validationErr, networkErr)
// errors.Is / errors.As traverse the full tree
```

**Sentinel vs custom types — decision tree:**

```go
// Sentinel: static condition, identity-based matching
var ErrNotFound = errors.New("not found")
if errors.Is(err, ErrNotFound) { ... }

// Custom type: callers need structured data beyond identity
type ValidationError struct { Field, Message string }
func (e *ValidationError) Error() string { ... }

var ve *ValidationError
if errors.As(err, &ve) { ... }
```

**Generic error matching (1.26+) — type-safe, no pointer variable needed:**

```go
// Old: requires pre-declared variable
var ve *ValidationError
if errors.As(err, &ve) { handleValidation(ve) }

// New (1.26): generic, returns value directly
if ve, ok := errors.AsType[*ValidationError](err); ok {
    handleValidation(ve)
}
```

## Error Ownership

Use one owner per error. Classify and log each error in exactly one place. Shared functions should own classification only when every caller needs the same handling; otherwise return enough context and let callers classify. Do not log the same error in multiple layers.

Before changing an error path, trace the full chain:

1. Source error: where the error is created or returned
2. Wrap point: where context is added with `%w`
3. Classification owner: retryable, not found, validation, internal, etc.
4. Log owner: the single layer allowed to log this error
5. Transport mapping: HTTP, gRPC, GraphQL status and response shape
6. Test expectation: existing or new coverage for the intended behavior

Do not make blind single-layer patches. When modifying returned errors, diff the before/after paths. Intentional behavior changes need their own tests; simplification or refactor work must preserve `errors.Is`/`errors.As`, messages relied on by callers, logging ownership, and transport mapping. Run relevant error-path tests after any change.

**Anti-patterns:**

- Don't log AND return the same error — handle it once
- Don't add redundant "failed to" prefixes — they pile up through call chain
- Don't `_ = fn()` — errcheck linter catches this
- Don't use `panic` for expected error conditions
- Don't compare with `==` or `.Error()` string — always `errors.Is`/`errors.As`
