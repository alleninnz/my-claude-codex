# Story Point Estimation

Fibonacci scale: **0, 1, 2, 3, 5, 8**. **8 is the cap** — work that feels larger must be split before scoring.

## Meta rule — estimate from scratch

Assume the issue has not been started. Estimate the full effort it would take an engineer unfamiliar with the work to complete it from zero. **Do not** discount for:

- Investigation already done
- A PR that already exists (reverse-engineered tickets)
- Decisions already made elsewhere

The estimate represents *total work to ship*, not *work remaining*. This is the only basis on which team velocity stays self-consistent.

## Decision-tree scoring

Compute a number, then snap to Fibonacci.

```
Base = 2  (one PR's worth of independent work)

Adjusters (additive unless noted):

  +1  Schema change (DB column / index / table)
  +1  Proto / GraphQL / REST contract change
  +1  Touches a second service (your team owns it)
  +2  Touches a third or more services
  +2  Data migration with backfill or dual-write
  +2  Cross-team coordination (PR or owner outside your team)
       Stacks with service adjusters above — touching one service owned by
       another team is +1 (second service) +2 (cross-team) = +3.
  +1  Completely new pattern (no adjacent precedent in repo)
  +1  High unknowns (core problem unsolved here before / sparse docs)
  +1  Content volume (≥5 independent sub-deliverables — named templates,
       UI states, endpoints, entity fields, pixel-level design alignment)
  +1  Design density (cap +1, not stackable — see triggers below)

Reducers (cap -1 total):

  -1  Concentrated change + fully reversible + well-carved Out of scope
       (any 1-3 of these → -1; never below)

Floor:  1 for any real work, 0 only for story-label parent containers.
Cap:    8. If the computed value exceeds 8, split the issue and rescore.

Round to Fibonacci:
  0 → 0,  1 → 1,  2 → 2,  3-4 → 3,  5-7 → 5,  ≥8 → 8
```

### Design-density triggers (cap +1)

**Principle**: the work requires a decision that is expensive to undo if wrong — not "write it, adjust later".

Trigger if **any one** of these is true. Cap remains +1 even if multiple trigger.

| # | Trigger | Schema example | API example | UI example | Behavior example |
|---|---------|----------------|-------------|------------|------------------|
| ① | **External-spec authority** — design must conform to a *named* external authority | AIIR record widths; ITAA s276; ISO 4217 | Stripe API contract; OAuth 2.1; OpenAPI 3 spec | WCAG 2.2 AA; named design system / brand spec | RFC 7234 cache; SLA doc; regulatory T+1 |
| ② | **Multi-state modeling** — ≥3 mutually exclusive states / variants, each driving distinct behavior | enum ≥3 values, each with its own branch | proto `oneof` with ≥3 variants; polymorphic response | wizard with ≥3 steps; role-based view variants | state machine with ≥3 states |
| ③ | **Cross-representation mapping** — fields/state must stay consistent across ≥2 external representations | DB ↔ proto ↔ third-party API field | internal model ↔ wire format ↔ external contract | UI state ↔ API ↔ business model | service A ↔ service B semantic alignment |

Authority must be **nameable**. "Industry best practice" or "looks like good design" does not qualify.

### The 3-vs-5 escalation

If the computed value lands in 3–4, ask one question before snapping:

> If the last mile (review / QA / deploy) goes wrong, what's the blast radius?

- Only this PR → keep at 3
- Adjacent features, existing callers, or legally / financially observable output → escalate to 5

## Story-label parent issues

Parent containers whose work lives in child task issues. Each child is scored individually, so the parent must not double-count.

- Default the parent to **0 or 1**
- Score higher only when the parent itself carries coordination overhead beyond what the child tasks capture (e.g. cross-team launch sync, kickoff design review)

## Anti-patterns (do NOT use these as estimation signals)

| ✗ Don't | Reason |
|---------|--------|
| Use description length | Long ticket = clear writing, not heavy work |
| Use heading / sub-heading count | Structure ≠ scope |
| Use domain-term density (`AMIT`, `s276`, `ITAA`) | Domain words don't add engineering work. They only count if they trigger External-spec authority — i.e. the term names a specification you must conform to. |
| Add +1 because the issue bundles multiple originally-split sub-issues | Bundling is an organizational choice. Score the actual work; the bundling itself adds nothing. |
| Count "why this design" sentences in the description | Rewards verbose authors and punishes terse-but-correct ones |
| Add +1 because Out of scope is long | A well-carved Out of scope **lowers** the score (it's a reducer signal, not an inflation signal) |

## How to estimate — process

1. **Read Context and Scope.** Internalize what is actually being built (not how it's described).
2. **Compute base + adjusters - reducers.** Walk the list mechanically; each adjuster needs a concrete signal.
3. **Apply reducers** if applicable (cap -1).
4. **Snap to Fibonacci.** If result is 3–4, run the 3-vs-5 escalation question.
5. **Output the score with a one-sentence rationale that names the adjusters that moved it** — not abstract dimensions.

## Output format

```
**Story point: <N>** — base 2 + <adjuster> + <adjuster> - <reducer>; <one-line context>.
```

The rationale must reference the adjusters that fired. **Banned**: `effort severe`, `complexity moderate`, `feels like a 5` — these are circular and give no signal.

### Examples

`**Story point: 3** — base 2 +1 schema +1 design density (AIIR widths, DB↔AIIR mapping) -1 concentrated/reversible; single-service schema with externally-constrained widths.`

`**Story point: 5** — base 2 +1 content (≥13 sub-templates, Figma alignment) +1 high unknowns (multi-class loop) -1 concentrated/reversible; escalated 3→5 (statement is a legally observable output).`

`**Story point: 1** — base 2 -1 concentrated/reversible; pure copy change in one component.`

`**Story point: 8** — base 2 +2 third+ services +2 migration backfill +2 cross-team; cap reached, work crosses 3 services with a backfilled migration owned partly by another team.`

## When you cannot estimate confidently

Say so explicitly and name what is missing. Do **not** guess.

Examples of missing information that block estimation:
- Number of services in scope is unclear
- External-spec authority is referenced but not named
- Migration strategy (dual-write? backfill?) is unspecified
- Cross-team dependencies exist but aren't enumerated

Hoist these into `[CONFIRM]` items in the issue draft, resolve them, then estimate.
