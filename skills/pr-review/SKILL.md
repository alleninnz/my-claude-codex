---
name: pr-review
description: Use when the current PR has AI reviewer comments (CodeRabbit, Cursor, etc.) that need to be reviewed and addressed, or when the user says "pr review", "review comments", "fix review comments".
---

# PR Review

Interactive review of AI reviewer comments on the current PR. Dispatches a subagent to silently gather and classify comments, then presents results for interactive review.

## Prerequisites

- `gh` CLI installed and authenticated
- Current branch has an open PR (or PR URL/number provided as argument)

## Step 1 — Gather and classify comments (silent)

Dispatch a subagent using the prompt template in `data-gather.md`. The subagent silently:

- Identifies the PR and repo
- Fetches unresolved review threads
- Fetches bot comments, filters to unresolved only
- Partitions outdated comments
- Auto-triages Copilot comments (high false-positive rate)
- Classifies severity and deduplicates

The subagent returns structured data with: `pr`, `outdated[]`, `copilot_triage[]`, `critical_major[]`, `medium_low[]`, and `thread_map[]`.

If the subagent reports no comments, output "No AI review comments found" and stop.

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

For each Critical/Major comment (or deduplicated group), perform deep analysis before presentation.

Read `deep-analysis.md` for the methodology, severity re-evaluation rules, presentation template, and user response handling via `AskUserQuestion`.

If all Critical/Major comments are downgraded during deep analysis, skip this step and merge them into Step 4.

## Step 4 — Medium/Low overview + rescue

Present all Medium/Low comments (including any downgraded from Step 3) as a numbered overview. Default action is skip; user can rescue specific comments for deep review.

Each entry must include: what the reviewer wants (plain language), your recommendation (fix/skip), and brief reasoning.

```text
── Medium/Low (N comments, default skip) ──────
1. [Medium] path/to/file.go:88 (coderabbit)
   Reviewer wants: Add context cancellation check to prevent goroutine leak.
   Recommendation: Fix — real concern, handler runs unbounded without cancellation.

2. [Low] path/to/model.go:33 (coderabbit)
   Reviewer wants: Remove unused `opts` parameter from function signature.
   Recommendation: Skip — matches existing codebase convention.

Enter numbers to rescue for deep review (e.g. 1,2), or press Enter to skip all:
```

| User input | Behavior |
|------------|----------|
| Enter (empty) | All skip, proceed to Step 5 |
| `1,3` | Deep-analyze selected using Step 3 process, rest skip |
| `all` | Rescue all, present each using Step 3 |

**Rescue flow:** Deep-analyze using `deep-analysis.md`, present with same template. If severity upgraded, show change in header (e.g., `[Medium → Major]`). User responds via `AskUserQuestion`.

## Step 5 — Apply queued fixes

Show the review summary:

```text
── Review Summary ──────────────────────────
Critical/Major: 3 comments (2 fix, 1 skip)
Medium/Low:     5 comments (1 rescued → fix, 4 skipped)
Outdated:       2 comments (auto-skipped)
Copilot:        4 comments (1 promoted → fix, 3 auto-skipped)
Duplicates:     3 comments merged into 2 groups
────────────────────────────────────────────
Total: 17 comments → 4 fixes queued
```

If no fixes queued: report "No fixes to apply" and proceed to Step 6.

If fixes queued: apply all fixes, run build/lint/test to verify, show summary of changes.

## Step 6 — Commit and push

Use `AskUserQuestion`: `["Commit and push (Recommended)", "Skip"]`

If **Commit and push**: stage changed files, create a descriptive commit, push.
If **Skip**: do NOT commit or push.

## Step 7 — Reply and resolve threads

Use `AskUserQuestion`: `["Yes (Recommended)", "No"]`

If **No**: done.

If **Yes**: read `resolve-threads.md` for API commands and reply rules. **Every thread MUST receive a reply before being resolved** — never resolve silently.

## Common mistakes

- **Echoing AI text verbatim** — Translate to plain language. The Analysis section is YOUR independent analysis.
- **Shallow analysis without reading diff/context** — For Critical/Major, you MUST read the git diff and function context before presenting.
- **Agreeing with the reviewer by default** — Form your own judgment. If the concern doesn't apply, say so.
- **Committing or pushing without asking** — Always use `AskUserQuestion` in Step 6.
- **Fixing without queuing first** — Go through ALL comments (Steps 3 + 4) before applying fixes in Step 5.
- **Resolving threads without replying** — Every thread must get a reply explaining why it was resolved.
