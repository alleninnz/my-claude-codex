---
paths:
  - "**/*.go"
---

# Go Code Quality

**CRITICAL — You MUST follow these rules before writing any Go code. Violations are treated as bugs.**

## Before writing a new function

Run this checklist in order. Stop at the first match:

1. **Existing codebase** — Does a function in the current repo already do this (or nearly this)? Refactor it to be reusable instead of writing a duplicate.
2. **Stdlib** — `slices`, `maps`, `strings`, `sort`, `bytes`, `cmp`, `sync`, `math/bits`, `crypto/*`, `encoding/*`, etc.
3. **Compiler intrinsics** — stdlib wrappers (`bits.Len`, `bits.OnesCount`, `sync/atomic`) compile to single instructions. A hand-rolled loop is ALWAYS worse.
4. **Libraries in go.mod** — `samber/lo`, `golang.org/x/*`, `github.com/JasperLabs/cast`, etc.

If any of these exist, you MUST use them. No exceptions. No "similar but slightly different" justifications.

## Before adding a function that parallels an existing one

If you're about to create `fooWithX` alongside an existing `foo`:
- **STOP.** Refactor `foo` to handle both cases (add a parameter, change the signature, or extract the shared logic).
- Two functions doing nearly the same thing is always wrong. The cost of refactoring callers is lower than the cost of maintaining duplicates.
