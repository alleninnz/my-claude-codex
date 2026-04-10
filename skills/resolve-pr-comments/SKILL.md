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
- **Critical/Major fix/skip decisions** — **MUST** use `AskUserQuestion` with choices `["Fix", "Skip"]`. This renders interactive buttons instead of plain text.
- **Commit/push/resolve confirmation (Step 6)** — **MUST** use `AskUserQuestion` with choices `["Yes", "No"]`. Plain text questions do not block execution in auto mode — Claude will continue without waiting for the user's answer.
- **Medium/Low batch interaction** — use freeform text (no `AskUserQuestion`). The complex interaction model (`fix 1, skip 2, review 3`) doesn't fit button choices.

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
2. Present the comment using the unified template — every comment **MUST** include all fields: Problem, Wants, Analysis, Recommendation. **DO NOT** skip any field.
3. **MUST** ask using `AskUserQuestion` with choices `["Fix", "Skip"]` — **DO NOT** proceed to the next comment without the user's explicit decision. **DO NOT** auto-decide on the user's behalf.
4. Record the user's decision, move to next comment

| User input | Behavior |
|------------|----------|
| `Fix` (button) | Queue for fix, move to next comment |
| `Skip` (button) | Skip, move to next comment |

**Severity re-evaluation during deep analysis:** If a comment is downgraded below Major, **DO NOT** present it here — move it to Step 4 (Medium/Low batch). If all Critical/Major comments are downgraded, skip this step entirely.

## Step 4 — Medium/Low paginated review

**MUST** present all Medium/Low comments (including any downgraded from Step 3) using the unified template. Problem and Wants fields come from the data-gather subagent output. Analysis **MUST** be YOUR independent judgment — **DO NOT** just agree with the reviewer by default. Write it yourself based on the subagent's classification and the comment context.

Every Medium/Low comment **MUST** use the same template structure as Critical/Major. **DO NOT** collapse Medium/Low comments into one-line summaries. Reduced depth means shorter content per field, not fewer fields:
- Problem: **MUST** be present — natural language explaining what's wrong with the code. Write as if explaining to a colleague sitting next to you.
- Wants: **MUST** be present — natural language explaining what the reviewer wants done. Write as if explaining to a colleague sitting next to you.
- Analysis: **MUST** be present — natural language with YOUR independent judgment. Write as if explaining to a colleague sitting next to you.
- Recommendation: **MUST** be present
- Original comment: **MUST** be present (collapsed)

### Pagination

Present comments **5 per page**. If total ≤ 5, show as a single page (no page header needed).

Numbering is **global** across all pages (1–N), not reset per page.

Each page **MUST** show its own defaults summary and confirmation prompt. User confirms the current page before the next page appears.

```text
── Medium/Low (13 comments) ── Page 1/3 ──────────

── 1/13 ── [Medium] ── [coderabbit] ──────────
📍 path/to/file.go:88

**Problem:**
This handler doesn't check context cancellation — if the request times out, the goroutine keeps running.

**Wants:**
Add a ctx.Done() case in the select to clean up on timeout.

**Analysis:**
The handler runs unbounded with no cancellation check — request timeouts leave zombie goroutines.

**Recommendation:** Fix

<details><summary>Original comment</summary>
...
</details>

── 2/13 ── [Low] ── [coderabbit] ──────────
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

...

── Page 1 Defaults ──────────────────────────
Auto-queued:  #1 context cancellation in handler (Fix)
Auto-skipped: #2 unused opts param (Skip), #3 ... , #4 ... , #5 ...

Override? (e.g., 'skip 1' or 'fix 2', 'ok' to confirm page):
```

After user confirms, lock decisions for current page and show next:

```text
── Medium/Low ── Page 2/3 ──────────

── 6/13 ── ...
```

Last page confirmed → proceed to Step 5.

### Interaction rules (per page)

| User input | Behavior |
|------------|----------|
| `ok` or `done` | Confirm current page defaults, show next page (or proceed to Step 5 if last page) |
| `skip N` or `skip 1,2` | Override to skip (current page only), rest keep defaults |
| `fix N` or `fix 1,3` | Override to fix (current page only), rest keep defaults |
| `skip all` | Override all on current page to skip |
| `fix all` | Override all on current page to fix |
| `review N` or `review 1,3` | Promote selected (current page only) to deep analysis, re-present one at a time at Critical/Major depth. Each gets an immediate `AskUserQuestion` with choices `["Fix", "Skip"]` — same as Step 3 |
| `review all` | Promote all on current page to deep analysis |

Users can combine in one response (e.g., `fix 1, skip 2, review 3`). All tokens are keyword-prefixed (`fix`, `review`, `skip`).

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

**MUST** use `AskUserQuestion` with choices `["Yes", "No"]` and question: "Commit and push, then reply and resolve threads?"

**DO NOT** ask via plain text — plain text questions do not block execution in auto mode, causing Claude to proceed without user confirmation.

If **Yes**: stage changed files, create a descriptive commit, push, then read `resolve-threads.md` for API commands and reply rules. **Every thread MUST receive a reply before being resolved** — **NEVER** resolve silently.
If **No**: **DO NOT** commit, push, or resolve.

## Common mistakes

- **Echoing AI text verbatim** — Problem, Wants, and Analysis **MUST** use natural conversational language. **NEVER** echo reviewer phrasing like "Consider adding..." or "It is recommended that...". Analysis is YOUR independent judgment, written in the same conversational tone as Problem and Wants.
- **Skipping Problem, Wants, or Analysis fields** — Every comment at every severity level **MUST** include Problem, Wants, and Analysis. These fields are NOT optional. DO NOT skip them, even for Low severity.
- **Collapsing Medium/Low to one-line summaries** — Medium/Low **MUST** use the same template structure as Critical/Major. Reduced depth means shorter sentences, NOT fewer fields.
- **Batching Critical/Major comments** — Critical/Major **MUST** be presented one at a time. **DO NOT** show multiple Critical/Major comments in a single message.
- **Analyzing without reading the code** — For Critical/Major, you **MUST** read the git diff and function context before writing Analysis. The fact that Diff is not a separate display field does NOT mean you can skip reading the code. **DO NOT** analyze from the comment text alone.
- **Agreeing with the reviewer by default** — **MUST** form your own independent judgment. **DO NOT** default to agreeing with the reviewer. If the concern doesn't apply, say so explicitly.
- **Committing or resolving without asking** — **MUST** use `AskUserQuestion` (not plain text) in Step 6. **NEVER** commit, push, or resolve threads without explicit confirmation. Plain text questions do not block in auto mode.
- **Using plain text for blocking confirmations** — Any confirmation that **MUST** block execution (Step 3 Fix/Skip, Step 6 commit/push) requires `AskUserQuestion`. Plain text questions are only for non-blocking interactions (Step 4 page confirmations).
- **Fixing without queuing first** — **MUST** go through ALL comments (Steps 3 + 4) before applying fixes in Step 5. **DO NOT** start fixing during the review steps.
- **Resolving threads without replying** — Every thread **MUST** get a reply explaining why it was resolved. **NEVER** resolve silently.
