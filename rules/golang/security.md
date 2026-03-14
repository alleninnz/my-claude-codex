---
paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Security

## Secret Management

```go
apiKey := os.Getenv("OPENAI_API_KEY")
if apiKey == "" {
    log.Fatal("OPENAI_API_KEY not configured")
}
```

## Security Scanning

- Use **gosec** for static security analysis:

  ```bash
  gosec ./...
  ```

## Context & Timeouts

Always use `context.Context` for timeout control:

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
```

## Security Response Protocol

If a security issue is found:

1. STOP immediately
2. Use **security-reviewer** agent
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets
5. Review codebase for similar issues
