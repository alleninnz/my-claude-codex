---
name: goal-driven-code-review
description: |
  Use after implementing an OpenSpec change, before running archive. Tests
  prove behavior; this skill checks whether the implementation (a) realizes
  the change's goals (`proposal.md` + `specs/`) and (b) honors the
  conventions external to the change (`design.md` architectural commitments,
  `CLAUDE.md` / `AGENTS.md` / repo conventions, neighboring code). Both
  checks are silent in tests. Trigger phrases: "audit before archive",
  "did the agent really deliver this change?", "is there a simpler way to
  realize this?". Skip trivial diffs.
---

# Goal-Driven Code Review

## The Distinction

A passing test proves **goal achieved** — the spec's MUST clauses hold at the wire / contract level.

It does NOT prove **goal aligned** — that the implementation honors the conventions the code must match: `design.md`'s architectural commitments, `CLAUDE.md` / `AGENTS.md` / repo conventions, and neighboring code. Alignment is invisible to tests; the reviewer surfaces it.

## When to Use & Skip

**Use when:** an OpenSpec change is implemented (`tasks.md` complete, branch ready) and you're about to archive.

**Skip when:** trivial diffs (renames, formatting, docs-only); the change has no behavioral commitment (architectural cleanup with no `specs/` delta).

## Protocol

### Step 1 — Extract a numbered goal table from `proposal.md` + `specs/`

The change's **goal** is what `proposal.md` asked and what `specs/` committed to. (`design.md` is HOW you planned to realize the goal, not the goal itself — Step 3 criteria, not Step 1 source. Auditing code against the blueprint that produced it is tautology.)

| #  | Goal (verbatim)            | Source              | Verification standard          |
| -- | -------------------------- | ------------------- | ------------------------------ |
| G1 | "MUST X"                   | `specs/foo.md:42`   | Specific input → output        |
| G2 | "should support Y"         | `proposal.md:18`    | New endpoint exists, returns Z |

Vague goals ("be clean", "make it nicer") get rejected here — push back to the change author.

### Step 2 — Mark each goal: ✅ achieved / ⚠️ partial / ❌ missed

Trace the runtime path. Run the tests. Read the actual assertions. Don't infer from method names or commit messages.

A goal can pass tests yet be structurally weak — that's expected. Flag it for Step 3.

### Step 3 — For each ✅, audit alignment against external criteria

The code must match criteria from sources OUTSIDE the change's goal source:

- **`design.md` architectural commitments** — decisions the change made (e.g. "use library X", "single error contract"). Agents drift from these even when they wrote them — NOT tautological, verify.
- **`CLAUDE.md` / `AGENTS.md` / repo conventions** — code-level patterns (error handling, logging, layering, naming).
- **Prior art** — the closest neighboring code in the same package.

For each finding:

| Source citation                 | Symbol in this diff   | Smell observed                          |
| ------------------------------- | --------------------- | --------------------------------------- |
| `CLAUDE.md:42` — wrap with `%w` | `Foo` at `bar.go:55`  | Returns `errors.New(...)`, drops cause  |

Without a cited source, drop the finding — it's personal preference, not a spec-spirit violation.

If you find no smells, say so explicitly. Silence reads as "didn't run Step 3".

### Step 4 — Cost each proposed change

For every Step 3 finding you intend to push, quote the cost in concrete units: lines added/removed, files touched, mocks updated, contracts changed.

If cost exceeds benefit (e.g. breaks a stable cross-service contract for marginal structural gain), say so and don't push it. Demands without prices get ignored.

### Step 5 — Report by ROI

1. **Blocking** — any ❌ or ⚠️ from Step 2. The author cannot archive without addressing these.
2. **Strong recommendations** — Step 3 findings paired with their Step 4 cost quote. The author should address these unless the cost argument refutes the proposal.

Lead with bucket 1. Don't bury blocking issues under recommendations.

## Common Mistakes

- **Treating "tests pass" as alignment proof.** Tests prove behavior at endpoints, not the shape of the path that gets there — they're silent on dead code reachability, layer leaks, mixed error contracts, and `design.md` drift. Green CI completes Step 2, not Step 3.
- **Trusting agent-written tests uncritically.** Agents satisfy spec letter via dead code, sentinel params, double wrappers — and the tests they write still pass because the agent shaped both sides. Run Step 3 explicitly on agent-written diffs even when CI is green.
