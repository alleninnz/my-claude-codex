---
name: write-linear-issues
description: Use when drafting a Linear engineering issue (feature, refactor, schema change, migration, infra task) at "In Preparation" — anything where Context, Scope, Out of scope, and Acceptance Criteria need to express intent without freezing implementation. Also trigger when rewriting an issue whose sections have blurred into code-level detail.
---

# Linear Issue — Context / Scope / Out of scope / Acceptance Criteria

## Overview

An issue at **In Preparation** is an *intent contract*, not a merge contract. It tells reviewers *why*, implementers *what is in scope*, PM/triage *what is not*, and reviewers *when it's done*. Implementation details (SQL, proto signatures, code) belong in the PR — they freeze the issue prematurely if they show up here.

## When to use

- Drafting a new engineering issue: feature, refactor, schema change, migration, or infra task.
- Rewriting an issue whose sections have blurred (motivation in Scope, implementation in Scope, AC restating Scope).

### When NOT to use

| Issue type | Use instead |
| --- | --- |
| Bug | Bug template — repro / current / expected / environment. |
| Incident retro | Postmortem template — timeline / impact / root cause / actions. |
| Spike or research | Research template — question / approach / timebox / deliverable. |
| Product / feature scoping (pre-engineering) | A scoping doc, not an issue. |

## The four sections

| Section | Reader | Question |
| --- | --- | --- |
| Context | reviewer / future maintainer | Why does this exist? Who is blocked? Why now? |
| Scope | implementer / reviewer | What is in this issue? (At the contract level — name fields, endpoints, pages.) |
| Out of scope | PM / triage | What is NOT in this issue, and where does it live instead? |
| Acceptance Criteria | reviewer / implementer | How do we know it's done? |

A sentence that doesn't answer its section's question for its section's reader belongs somewhere else — or nowhere.

## Section discipline

### Context — name existing surfaces, not new ones

Context locates the problem on surfaces that **already exist** ("the `accounts` admin list is unscannable"). It does NOT name fields, endpoints, or components **introduced by this issue** — those belong in Scope.

| ✓ OK in Context | ✗ Belongs in Scope |
| --- | --- |
| "Operations cannot scan the `accounts` admin list" | "We're adding `is_archived` to `accounts`" |
| "The `ListAccounts` API currently returns all rows" | "Add an `include_archived` flag to `ListAccounts`" |
| "There is no soft-delete pattern in this service yet" | "Introduce an `archived_at` timestamp convention" |

### Scope — the what / how boundary

Scope names *what is in this issue* using business language. It does NOT specify *how to code it*. Behavior-bearing constraints stay; encoding mechanics go to the PR.

| Domain | ✓ Stays (intent / contract) | ⚠️ State as behavior, not mechanism | ✗ Belongs in PR |
| --- | --- | --- | --- |
| DB schema | Field name + business meaning; required/optional; uniqueness; cardinality | "Existing rows are treated as active" (not `DEFAULT FALSE`); "deleted records keep history" (not `ON DELETE CASCADE`) | Column types, index names, ALTER statements |
| gRPC / GraphQL | Field name + purpose; required/optional; pagination/sort contract; error categories (`NotFound` / `PermissionDenied`) | "Default excludes archived rows" (not `WHERE is_archived=false`) | proto signatures, field numbers, resolver code |
| UI | New / modified pages, components, actions; permission boundaries | "Archive action is admin-only" (not `useAuth().isAdmin`) | Component code, props shape, CSS |
| Authorization | Who can call / see what / which error | "Non-admin callers receive `PermissionDenied`" (not `requireRole()` calls) | RBAC config code |
| Migration semantics | How existing data is treated; whether dual-write/read is needed | "Backfill treats NULL as active" (not `UPDATE … SET is_archived=false`) | Backfill scripts, batch sizes |

**Two-question heuristic** for each Scope line:

1. **Drop this line — could the implementer still get it right?** No → keep. Yes → drop.
2. **Keep this line — would it lock implementation choices a year from now?** Yes → rewrite in business language.

### Out of scope — three tiers

Each item lands in exactly one tier. Naked "later" / "TBD" is rejected — push it back to `[CONFIRM]` and ask the user.

| Tier | Format | When |
| --- | --- | --- |
| Tracked | `<Item> — tracked in <ENG-1234 / Project X / milestone Y>.` | Already filed somewhere |
| Not planned | `<Item> — not planned (<reason>).` | Explicit decision not to do |
| Deferred | `<Item> — deferred (<trigger>).` | Will be reconsidered when `<trigger>` happens |

### Acceptance Criteria — outcome statements, not test scenarios

AC describes the **finished state**. Reviewers and implementers read it to know when to stop, not to learn how to test.

Rules:

- **3 items max.** More than 3 means Scope is unclear — fix Scope, not AC.
- **At least one invariant** — something that should NOT change. This is where regressions hide.
- **Outcome verbs only**: `is / are / returns / excludes / requires / contains`. **Banned**: `Run`, `Call`, `Verify`, `Check`, `Ensure`, `Add`, `Implement`, `Create`.
- **No checkboxes.** Bullet points only. Checkboxes invite QA-style enumeration.
- **No `[CONFIRM]`.** AC is the contract; unresolved questions belong in Scope first.
- **No mechanical mirror of Scope.** AC and Scope can share topics — they must — but AC is phrased as **observable state** while Scope is phrased as **instructions**. If an AC item is just a Scope instruction reworded as a sentence (e.g. Scope "Add `is_archived` column" → AC "`is_archived` column is added"), delete it.

| ✗ Bad | ✓ Good | Why |
| --- | --- | --- |
| `Run SELECT is_archived FROM accounts → no error.` | `is_archived field is queryable on accounts.` | Outcome, not test mechanic |
| `Add is_archived column to accounts.` | (delete — restates Scope) | AC ≠ Scope mirror |
| `Code is reviewed and tests pass.` | (delete — always true at merge) | Verifies nothing |
| `Performance is acceptable.` | `P95 of ListAccounts unchanged vs baseline.` | Threshold makes it observable |
| `[ ] Tenant with 1 archived + 1 active → returns 1.` | `Archived accounts are excluded by default.` | Outcome doesn't need fixture |

## Process

1. **Classify.** Confirm the request fits the supported types. Bug / retro / spike / scoping → hand off.

2. **Ground Scope — 4 explicit actions, in order**:

   **a. Confirm entity names.** For every entity / page / API the user mentioned, grep the repo. Use the exact name as it appears in code; if it differs from the user's wording, use the code name and `[CONFIRM]` the divergence.

   **b. Survey adjacent conventions.** In the same entity / service, look at three things:
   - existing soft-delete / status / archive patterns (so you don't reinvent the wheel)
   - naming conventions (`is_archived` vs `archived_at` vs `status: ARCHIVED`)
   - authorization patterns (which roles already exist, what they can do)

   **c. Confirm the wire surface.** For each API change, confirm whether it's gRPC, GraphQL, REST, or multiple — so it lands under the correct sub-heading.

   **d. Stop when grounded enough.** The goal is "every name and pattern reference in Scope maps to existing code, or is explicitly flagged as a new convention." Not "understand the entire service." Once a–c are checked, stop.

   **Grounding fallback — `[CONFIRM]` blocks; never silently fall back:**
   - Grep returns nothing for an entity the user named → do NOT pretend it exists. Mark `[CONFIRM: entity "X" not found in repo — is this new, or under a different name?]` and wait.
   - No adjacent convention found → state the gap explicitly in the draft. Two valid placements:
     - **Context** when describing the current-state fact ("No prior soft-archive pattern exists in this service.").
     - **Scope** when phrased as introducing the new convention ("Introduces a new `archived_at` convention; no prior soft-archive pattern in this service.").

3. **Draft into the template.** Use only the Scope sub-headings that apply; drop the rest. Mark every unknown inline as `[CONFIRM: <question>]` — never silently guess.

4. **Resolve `[CONFIRM]` items, one focused question at a time.** Do NOT probe Out of scope unprompted; soliciting scope questions invites scope creep.

5. **Deliver.** Render the markdown. If the user asks to create the issue, call Linear MCP `save_issue` with `state=In Preparation`.

**Story-point estimation is opt-in.** Run it only when the user explicitly asks, or when `save_issue` is invoked with an `estimate` parameter. The framework lives in [`story-point-estimation.md`](./story-point-estimation.md). Drafting does not estimate by default.

## Template

```markdown
## Context

<2–4 sentences. Reader: reviewer / future maintainer. Question: why this exists,
who is blocked, why now. Name existing surfaces freely; do not name fields,
endpoints, or components introduced by this issue.>

## Scope

<Reader: implementer / reviewer. Name what is in this issue at the contract level.
Use only the sub-headings that apply; drop the rest.>

### Schema
- <"Add Y field on entity X, meaning Z. Required/optional. Existing rows treated as ...">

### API
- <"Add / modify field Y on RpcA / QueryB, used for Z. Default behavior is ...">

### UI
- <"Add / modify action Y on page X. Visible to <role>.">

### Behavior
- <"X behavior now Y. Edge: <case> returns <error>.">

## Out of scope

- <Item> — tracked in <ENG-XXXX / Project Y / milestone Z>.
- <Item> — not planned (<reason>).
- <Item> — deferred (<trigger>).

## Acceptance Criteria

- <Outcome statement A.>
- <Outcome statement B.>
- <Invariant — something that does NOT change.>
```

Drop Scope sub-headings that don't apply. **Do not write `N/A` or "No changes."** — delete the heading. An empty heading invites the implementer to invent work or skip the section.

**Where Authorization and Migration concerns go**: the boundary table above lists Authorization and Migration as separate domains for the what/how check, but the Scope template uses only Schema / API / UI / Behavior sub-headings. Fold Authorization into API or UI ("Non-admin callers receive `PermissionDenied`" → API; "Archive action is admin-only" → UI). Fold Migration semantics into Schema ("Existing rows are treated as active" → Schema). Do not invent new sub-headings.

## Pre-delivery checklist

- [ ] **Context** names only existing surfaces; no fields/endpoints/components introduced by this issue.
- [ ] **Scope** uses business language; no SQL, no proto signatures, no struct definitions, no implementation code.
- [ ] **Scope** sub-headings present all have content; unused ones are deleted.
- [ ] **Scope grounding**: every named entity / endpoint / page is grep-verified in the repo, or explicitly flagged as new.
- [ ] **Out of scope**: every item is `tracked` / `not planned` / `deferred(trigger)`. No naked "later" / "TBD".
- [ ] **Acceptance Criteria**: ≤3 items; outcome verbs only; ≥1 invariant; no checkboxes; no `[CONFIRM]`; no 1:1 Scope mirror.
- [ ] No `[CONFIRM:` remains anywhere in the draft.
- [ ] If the user asks to create the issue via `save_issue`, default `state=In Preparation`.

## Worked example — Add archive flag to accounts

### ✗ Bad — sections blurred, AC restates Scope

```markdown
## Context

Add an `is_archived BOOLEAN NOT NULL DEFAULT FALSE` column to `accounts` so
admin list can filter archived rows. Index on the column to keep filters cheap.

## Scope

### Schema
- `ALTER TABLE accounts ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;`
- `CREATE INDEX accounts_is_archived_idx ON accounts(is_archived);`

### API
- Add `bool include_archived = 5` to `ListAccountsRequest`.

## Out of scope
- Bulk archive UI later.

## Acceptance Criteria
- [ ] is_archived column exists.
- [ ] Code is reviewed and merged.
```

What went wrong:

- **Context** is a snapshot of the implementation (`is_archived`, `BOOLEAN`, `DEFAULT FALSE`, index name) — a reviewer next year doesn't need any of it; it also names a field this issue is *introducing*, not an existing surface.
- **Scope** specifies SQL and a proto field number — locks implementation choices the PR should be free to refine.
- **Out of scope** "later" has no destination — rots into tribal knowledge.
- **AC** restates Scope ("column exists") and uses non-observable theatre ("code reviewed").

### ✓ Good — intent only, contract-level details preserved

```markdown
## Context

Operations cannot remove dormant accounts from their working list, which
currently shows ~3k entries and is unscannable. We need a soft-archive
mechanism so the existing accounts admin list can hide archived rows
without deleting history. No prior soft-archive pattern exists in this
service.

## Scope

### Schema
- Add an archive flag on the `accounts` entity. The flag is required —
  no NULL state. Existing rows are treated as active.

### API
- `ListAccounts` accepts an opt-in flag to include archived accounts.
  Default behavior excludes them; existing callers see no change.
- Non-admin callers passing the include-archived flag receive
  `PermissionDenied`.

### Behavior
- Archived accounts no longer appear in the admin list by default.
- Sort order and pagination semantics are unchanged when the flag is absent.

## Out of scope

- Bulk archive UI — tracked in ENG-1234.
- Auto-archive policy (inactivity threshold) — deferred (revisit after
  archive-adoption metrics in Q3).
- Unarchive flow — not planned (operations explicitly prefer manual
  database edits for now).

## Acceptance Criteria

- Archived accounts are excluded from `ListAccounts` by default.
- Setting the include-archived flag returns the union of archived and active.
- Existing callers' sort order and pagination are unchanged.
```

Why this works:

- **Context** explains *who is blocked* (operations) and *why now* (3k entries, unscannable). It names the existing `accounts` admin list (allowed — already exists) but no new field, no column types, no index names. The "no prior soft-archive pattern" line is grounding output, not motivation.
- **Scope** preserves contract-bearing details — required-ness, existing-row migration semantics, auth boundary, default behavior — without specifying SQL, proto field numbers, or code.
- **Out of scope** uses all three tiers — `tracked`, `deferred(trigger)`, `not planned(reason)`.
- **AC** has 3 items: 2 outcomes + 1 invariant ("sort order and pagination unchanged"). No checkboxes, no test mechanics, no Scope mirror.
- **State on create**: `In Preparation`. Story point: not estimated unless the user asks.
