---
name: resolve-pr-comments
description: Use when the current PR has AI reviewer comments (CodeRabbit, Cursor, etc.) that need to be reviewed and addressed, or when the user says "pr review", "review comments", "fix review comments".
---

# PR Review

Interactive review of all unresolved PR review comments — both AI reviewer (CodeRabbit, Cursor, Copilot, etc.) and human reviewer comments. Dispatches a subagent to silently gather and classify comments, then presents results for interactive review.

## Prerequisites

- `gh` CLI installed and authenticated
- Current branch has an open PR (or PR URL/number provided as argument)

## Tool constraints

- **`gh` CLI only** — use `gh api` (via Bash tool) for all GitHub API calls. **NEVER** use GitHub MCP tools.
- **NEVER** use `AskUserQuestion` — present your analysis and recommendation, then let the user type a freeform response (`fix`, `skip`, `1,3`, etc.).

## Step 1 — Gather and classify comments (silent)

Dispatch a subagent using the prompt template in `data-gather.md`. The subagent silently:

- Identifies the PR and repo
- Fetches unresolved review threads
- Fetches all comments (bot and human), filters to unresolved only
- Partitions outdated comments
- Auto-triages Copilot comments (high false-positive rate)
- Classifies severity and deduplicates

The subagent returns structured data with: `pr`, `outdated[]`, `copilot_triage[]`, `critical_major[]`, `medium_low[]`, and `thread_map[]`.

If the subagent reports no comments, output "No review comments found" and stop.

## Step 2 — Present triage summaries

Show the subagent's triage results. Only show sections that have content:

**Outdated** (if any):

```text
── N outdated comment(s) ──────────
1. [bot-name] path/to/file.go — <one-line summary>
```

**Copilot triage** (if any):

```text
── N Copilot comment(s) (auto-triaged) ──────────
1. ✗ path/to/file.go:42 — <one-line summary> — <why skipped>
2. ✓ path/to/file.go:88 — <one-line summary> — promoted
```

## Step 3 — Critical/Major interactive review

**MUST** present Critical/Major comments **one at a time**. **DO NOT** batch or group multiple comments in a single message.

For each comment (or deduplicated group):

1. **MUST** perform deep analysis — read `deep-analysis.md` for methodology, severity re-evaluation rules, and the unified presentation template
2. Present the comment using the unified template — every comment **MUST** include all fields: Problem, Wants, Diff, Analysis, Recommendation. **DO NOT** skip any field.
3. **MUST** ask: `Fix or skip?` — **DO NOT** proceed to the next comment without the user's explicit decision. **DO NOT** auto-decide on the user's behalf.
4. Record the user's decision, move to next comment

| User input | Behavior |
|------------|----------|
| `fix` | Queue for fix, move to next comment |
| `skip` | Skip, move to next comment |

**Severity re-evaluation during deep analysis:** If a comment is downgraded below Major, **DO NOT** present it here — move it to Step 4 (Medium/Low batch). If all Critical/Major comments are downgraded, skip this step entirely.

## Step 4 — Medium/Low batch review

**MUST** present all Medium/Low comments (including any downgraded from Step 3) using the unified template — but without Diff (no deep analysis prerequisite). Problem and Wants fields come from the data-gather subagent output. Analysis **MUST** be YOUR independent judgment — **DO NOT** just agree with the reviewer by default. Write it yourself based on the subagent's classification and the comment context.

Every Medium/Low comment **MUST** use the same template structure as Critical/Major. **DO NOT** collapse Medium/Low comments into one-line summaries. Reduced depth means shorter content per field, not fewer fields:
- Problem: 1 sentence — **MUST** be present
- Wants: 1 sentence — **MUST** be present
- Analysis: 1 sentence — **MUST** be present
- Recommendation: **MUST** be present
- Original comment: **MUST** be present (collapsed)
- No Diff section

**MUST** present all comments as a numbered batch, then **MUST** show the defaults summary:

````text
── Medium/Low (N comments) ──────────────────

── 1/N ── [Medium] ── [coderabbit] ──────────
📍 path/to/file.go:88

**Problem:**
This handler doesn't check context cancellation — if the request times out, the goroutine keeps running.

**Wants:**
Add a ctx.Done() case in the select to clean up on timeout.

**Analysis:**
Real concern — the handler runs unbounded with no cancellation check.

**Recommendation:** Fix

<details><summary>Original comment</summary>
...
</details>

── 2/N ── [Low] ── [coderabbit] ──────────
📍 path/to/model.go:33

**Problem:**
The `opts` parameter is declared but never used.

**Wants:**
Remove the unused parameter.

**Analysis:**
Matches existing codebase convention — other handlers keep unused opts.

**Recommendation:** Skip

<details><summary>Original comment</summary>
...
</details>

── Defaults ──────────────────────────
Auto-queued:  #1 context cancellation in handler (Fix)
Auto-skipped: #2 unused opts param (Skip)

Override? (e.g., 'skip 1' or 'fix 2', 'ok' to confirm):
````

**Interaction rules:**

| User input | Behavior |
|------------|----------|
| `ok` or `done` | Confirm all defaults, proceed to Step 5 |
| `skip N` or `skip 1,2` | Override to skip, rest keep defaults |
| `fix N` or `fix 1,3` | Override to fix, rest keep defaults |
| `skip all` | Override all to skip |
| `fix all` | Override all to fix |
| `review N` or `review 1,3` | Promote selected to deep analysis (read diff + function context), re-present at Critical/Major depth with immediate fix/skip per comment |
| `review all` | Promote all to deep analysis |

Users can combine in one response (e.g., `fix 1, skip 2, review 3`). All tokens are keyword-prefixed (`fix`, `review`, `skip`).

**`review N` flow:** Deep-analyze using `deep-analysis.md`, then re-present each promoted comment one at a time at Critical/Major depth (with Diff). Each gets an immediate `Fix or skip?` prompt — same as Step 3.

## Step 5 — Apply queued fixes

Show the review summary:

```text
── Review Summary ──────────────────────────
Critical/Major: 3 comments (2 fix, 1 skip)
Medium/Low:     5 comments (1 reviewed → fix, 4 skipped)
Outdated:       2 comments (auto-skipped)
Copilot:        4 comments (1 promoted → fix, 3 auto-skipped)
Duplicates:     3 comments merged into 2 groups
────────────────────────────────────────────
Total: 17 comments → 4 fixes queued
```

If no fixes queued: report "No fixes to apply." then skip straight to replying and resolving threads — no commit/push needed, no confirmation prompt. Read `resolve-threads.md` for API commands and reply rules.

If fixes queued: apply all fixes, **MUST** run build/lint/test to verify — **DO NOT** skip verification. Show summary of changes, then proceed to Step 6.

## Step 6 — Commit, push, and resolve threads

**MUST** ask: "Commit and push, then reply and resolve threads? (y/n, recommended: y)"

If **y**: stage changed files, create a descriptive commit, push, then read `resolve-threads.md` for API commands and reply rules. **Every thread MUST receive a reply before being resolved** — **NEVER** resolve silently.
If **n**: **DO NOT** commit, push, or resolve.

## Common mistakes

- **Echoing AI text verbatim** — Problem and Wants **MUST** use natural conversational language. **NEVER** echo reviewer phrasing like "Consider adding..." or "It is recommended that...". The Analysis section is YOUR independent judgment.
- **Skipping Problem or Wants fields** — Every comment at every severity level **MUST** include Problem and Wants. These fields are NOT optional. DO NOT skip them, even for Low severity.
- **Collapsing Medium/Low to one-line summaries** — Medium/Low **MUST** use the same template structure as Critical/Major. Reduced depth means shorter sentences, NOT fewer fields.
- **Batching Critical/Major comments** — Critical/Major **MUST** be presented one at a time. **DO NOT** show multiple Critical/Major comments in a single message.
- **Shallow analysis without reading diff/context** — For Critical/Major, you **MUST** read the git diff and function context before presenting. **DO NOT** analyze from the comment text alone.
- **Agreeing with the reviewer by default** — **MUST** form your own independent judgment. **DO NOT** default to agreeing with the reviewer. If the concern doesn't apply, say so explicitly.
- **Committing or resolving without asking** — **MUST** ask the user in Step 6. **NEVER** commit, push, or resolve threads without explicit confirmation.
- **Fixing without queuing first** — **MUST** go through ALL comments (Steps 3 + 4) before applying fixes in Step 5. **DO NOT** start fixing during the review steps.
- **Resolving threads without replying** — Every thread **MUST** get a reply explaining why it was resolved. **NEVER** resolve silently.
