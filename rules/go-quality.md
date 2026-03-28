---
paths:
  - "**/*.go"
---

# Rule of Go quality

**CRITICAL — You MUST follow these rules before presenting any Go code. Violations are treated as bugs.**

You MUST NOT write a utility function until you have checked all three in order:

1. **Stdlib** — `math/bits`, `slices`, `maps`, `strings`, `sort`, `bytes`, `unicode`, `sync`, `cmp`, `crypto/*`, `encoding/*`, etc.
2. **Compiler intrinsics** — stdlib wrappers (`bits.Len`, `bits.OnesCount`, `sync/atomic`) compile to single hardware instructions. A hand-rolled loop is ALWAYS worse.
3. **Libraries already in go.mod** — `samber/lo`, `golang.org/x/*`, etc.

If a stdlib or dependency function exists, you MUST use it. No exceptions.
