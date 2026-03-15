---
description: Use when simplifying Go code for clarity and maintainability.
  Runs staticcheck gosimple checks then applies structural simplifications
  using Go idioms. Default targets current branch changes.
---

# Go Simplify

This command invokes the **go-simplifier** agent to simplify Go code using a 3-layer approach.

## What This Command Does

1. **Determine targets**: Finds Go files changed on the current branch (or uses specified paths)
2. **Layer 1 -- Tool fixes**: Runs `staticcheck -checks "S*"` for mechanical simplifications (35+ gosimple rules)
3. **Layer 2 -- Structural**: AI checks for error flow, function length, nesting depth, naming
4. **Layer 3 -- Architectural**: AI checks for file length, unused interfaces, global state, one-shot helpers
5. **Verify**: Runs `go build` to confirm no regressions

## Usage

```text
/go-simplify                    # Simplify files changed on current branch
/go-simplify path/to/file.go   # Simplify specific file(s)
```

## Three-Layer Model

| Layer | Method | What it catches |
|-------|--------|-----------------|
| 1. Mechanical | `staticcheck -checks "S*"` | Boolean simplification, redundant code, stdlib misuse |
| 2. Structural | AI (golang-patterns) | Error flow, function length, nesting, naming |
| 3. Architectural | AI (golang-patterns) | File length, dead interfaces, global state |

## Prerequisites

- `staticcheck` installed (Layer 1 skipped if unavailable)
- Go toolchain for `go build` verification

## Suggested Workflow

1. `/go-test` -- ensure tests pass
2. `/go-simplify` -- simplify changed code
3. `/cr-review` -- CodeRabbit AI review
4. `/go-review` -- Go-specific review
5. Commit and push

## Related

- Agent: `agents/go-simplifier.md`
- Skill: `skills/golang-patterns/`
- Rules: `rules/golang/coding-style.md`
