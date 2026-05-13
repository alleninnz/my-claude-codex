---
name: write-linear-issues
description: Use when drafting a Linear engineering issue (feature, refactor, schema change, migration, infra task). Default output is Context + Scope only — Out of scope and Acceptance Criteria are written only when the user explicitly asks. Also trigger when rewriting an issue whose Context or Scope has blurred into code-level detail.
---

# Linear Issue — Context and Scope

## Overview

An engineering issue is an _intent contract_, not a merge contract. It tells reviewers _why_ and implementers _what is in scope_. Implementation details (SQL, proto signatures, code) belong in the PR — they freeze the issue prematurely if they show up here.

**Default output is Context + Scope only.** Out of scope and Acceptance Criteria add noise to most issues and are written only when the user explicitly asks for them.

## When to use

- Drafting a new engineering issue: feature, refactor, schema change, migration, or infra task.
- Rewriting an issue whose Context or Scope has blurred (motivation in Scope, implementation in Scope).
- Adding Out of scope or Acceptance Criteria only when the user explicitly asks for them.

### When NOT to use

| Issue type                                  | Use instead                                                      |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Bug                                         | Bug template — repro / current / expected / environment.         |
| Incident retro                              | Postmortem template — timeline / impact / root cause / actions.  |
| Spike or research                           | Research template — question / approach / timebox / deliverable. |
| Product / feature scoping (pre-engineering) | A scoping doc, not an issue.                                     |

## Sections

**Default output:**

| Section | Reader                       | Question                                                                        |
| ------- | ---------------------------- | ------------------------------------------------------------------------------- |
| Context | reviewer / future maintainer | Why does this exist? Who is blocked? Why now?                                   |
| Scope   | implementer / reviewer       | What is in this issue? (At the contract level — name fields, endpoints, pages.) |

**On request only:**

| Section             | Reader                 | Question                                                   |
| ------------------- | ---------------------- | ---------------------------------------------------------- |
| Out of scope        | PM / triage            | What is NOT in this issue, and where does it live instead? |
| Acceptance Criteria | reviewer / implementer | How do we know it's done?                                  |

A sentence that doesn't answer its section's question for its section's reader belongs somewhere else — or nowhere.

## Section discipline

### Context — name existing surfaces, not new ones

Context locates the problem on surfaces that **already exist** ("the `accounts` admin list is unscannable"). It does NOT name fields, endpoints, or components **introduced by this issue** — those belong in Scope.

| ✓ OK in Context                                       | ✗ Belongs in Scope                                 |
| ----------------------------------------------------- | -------------------------------------------------- |
| "Operations cannot scan the `accounts` admin list"    | "We're adding `is_archived` to `accounts`"         |
| "The `ListAccounts` API currently returns all rows"   | "Add an `include_archived` flag to `ListAccounts`" |
| "There is no soft-delete pattern in this service yet" | "Introduce an `archived_at` timestamp convention"  |

### Scope — the what / how boundary

Scope names _what is in this issue_ using business language. It does NOT specify _how to code it_. Behavior-bearing constraints stay; encoding mechanics go to the PR.

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

### Out of scope — only when the user asks

Each item names the thing not being done. Add a destination when one exists — a ticket reference, "not planned (reason)", or "deferred (trigger)". Bullet list, no forced format. If the user did not ask for this section, omit it entirely.

### Acceptance Criteria — only when the user asks

Describe the finished state, not the test plan. Prefer outcome verbs (`is / are / returns / excludes / requires / contains`) over imperative verbs (`Run`, `Verify`, `Add`). Don't restate Scope as outcomes — if an AC item is Scope reworded, drop it. If the user did not ask for this section, omit it entirely.

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

3. **Draft Context and Scope into the template.** Use only the Scope sub-headings that apply; drop the rest. Mark every unknown inline as `[CONFIRM: <question>]` — never silently guess. Do NOT write Out of scope or Acceptance Criteria at this step.

4. **Resolve `[CONFIRM]` items, one focused question at a time.** Do NOT probe Out of scope unprompted; soliciting scope questions invites scope creep.

5. **Add Out of scope / Acceptance Criteria only when the user explicitly asks.** Direct instructions like "include Out of scope", "list dependencies", "add AC", "what's the acceptance criteria" trigger the optional section. Do not infer intent from "make it comprehensive" or "cover everything." When in doubt, omit and let the user request it.

6. **Deliver.** Render the markdown. If the user asks to create the issue, call Linear MCP `save_issue` with `state=Todo` and `labels=["AI"]`. The `AI` label must already exist in the workspace — if `save_issue` fails because the label is missing, ask the user to create it in Linear once.

**Story-point estimation is opt-in.** Run it only when the user explicitly asks, or when `save_issue` is invoked with an `estimate` parameter. The framework lives in [`story-point-estimation.md`](./story-point-estimation.md). Drafting does not estimate by default.

## Template

Default output:

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
```

Drop Scope sub-headings that don't apply. **Do not write `N/A` or "No changes."** — delete the heading. An empty heading invites the implementer to invent work or skip the section.

**Where Authorization and Migration concerns go**: the boundary table above lists Authorization and Migration as separate domains for the what/how check, but the Scope template uses only Schema / API / UI / Behavior sub-headings. Fold Authorization into API or UI ("Non-admin callers receive `PermissionDenied`" → API; "Archive action is admin-only" → UI). Fold Migration semantics into Schema ("Existing rows are treated as active" → Schema). Do not invent new sub-headings.

Optional sections — append only when the user explicitly asks:

```markdown
## Out of scope

- <Item not being done> — <ENG-XXXX / not planned (reason) / deferred (trigger).>

## Acceptance Criteria

- <Outcome statement, phrased as observable state.>
```

## Pre-delivery checklist

- [ ] **Context** names only existing surfaces; no fields/endpoints/components introduced by this issue.
- [ ] **Scope** uses business language; no SQL, no proto signatures, no struct definitions, no implementation code.
- [ ] **Scope** sub-headings present all have content; unused ones are deleted.
- [ ] **Scope grounding**: every named entity / endpoint / page is grep-verified in the repo, or explicitly flagged as new.
- [ ] No `[CONFIRM:` remains anywhere in the draft.
- [ ] **Out of scope and Acceptance Criteria are absent** unless the user explicitly requested them.
- [ ] If Out of scope was requested: each item names what is not being done; a destination (ticket / not planned / deferred) is included when one exists.
- [ ] If Acceptance Criteria was requested: outcome verbs preferred; no Scope mirror.
- [ ] If the user asks to create the issue via `save_issue`, default `state=Todo` and `labels=["AI"]`.

## Worked example — Add archive flag to accounts

### ✗ Bad — sections blurred, implementation leaking up

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
```

What went wrong:

- **Context** is a snapshot of the implementation (`is_archived`, `BOOLEAN`, `DEFAULT FALSE`, index name) — a reviewer next year doesn't need any of it; it also names a field this issue is _introducing_, not an existing surface.
- **Scope** specifies SQL and a proto field number — locks implementation choices the PR should be free to refine.

### ✓ Good — intent only, contract-level details preserved

```markdown
## Context

Operations cannot remove dormant accounts from their working list, which currently shows ~3k entries and is unscannable. We need a soft-archive mechanism so the existing accounts admin list can hide archived rows without deleting history. No prior soft-archive pattern exists in this service.

## Scope

### Schema

- Add an archive flag on the `accounts` entity. The flag is required — no NULL state. Existing rows are treated as active.

### API

- `ListAccounts` accepts an opt-in flag to include archived accounts. Default behavior excludes them; existing callers see no change.
- Non-admin callers passing the include-archived flag receive `PermissionDenied`.

### Behavior

- Archived accounts no longer appear in the admin list by default.
- Sort order and pagination semantics are unchanged when the flag is absent.
```

Why this works:

- **Context** explains _who is blocked_ (operations) and _why now_ (3k entries, unscannable). It names the existing `accounts` admin list (allowed — already exists) but no new field, no column types, no index names. The "no prior soft-archive pattern" line is grounding output, not motivation.
- **Scope** preserves contract-bearing details — required-ness, existing-row migration semantics, auth boundary, default behavior — without specifying SQL, proto field numbers, or code.
- **Out of scope and Acceptance Criteria are absent** — they're opt-in. Append them following the Optional sections template only when the user explicitly asks ("include OoS", "what's the AC").
- **State on create**: `Todo`. **Labels on create**: `AI` (attached by default). Story point: not estimated unless the user asks.
