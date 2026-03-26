---
name: pr-ops
description: Use when managing existing PRs with gh CLI — checking status, merging, listing, or changing PR state. Triggers on "merge PR", "PR status", "list my PRs", "mark as draft", "check CI", "close PR", "reopen PR", "update PR".
---

# PR Operations

Swiss-army-knife for PR lifecycle management using `gh` CLI. Covers status, listing, CI checks, state changes, metadata updates, and merging.

**Does NOT cover:** PR creation (system prompt / agentic-dev flow), code review (`/pr-review`, `/cr-review`), or deployment (`caruso deploy`).

**When NOT to use:** User wants to create a new PR, review code changes, triage review comments, or deploy.

## Prerequisites

- `gh` CLI installed and authenticated
- For current-branch operations: cwd must be inside a git repo

## Command Convention

All commands use `<N>` for PR number and `-R <R>` for repo (e.g., `-R JasperLabs/entity-service`). Omit `-R` when operating on the current repo.

## Context Resolution

Resolve which PR to operate on:

1. **Explicit reference** in user message — `PR #22`, `entity-service#2079`, full GitHub URL
2. **Current branch** — `gh pr view --json number,url,state,title` from cwd
3. **Ambiguous** — ask the user

Cross-repo translation: `entity-service#2079` → `-R JasperLabs/entity-service 2079`

For list operations, choose scope from user intent:

- "list PRs" / "my PRs" → `gh search prs --author=@me --state=open --owner=JasperLabs`
- "list PRs in entity-service" → `gh pr list -R JasperLabs/entity-service`
- "PRs needing my review" → `gh search prs --review-requested=@me --state=open --owner=JasperLabs`

Default pagination is 30 results. Add `--limit 100` for comprehensive listings.

## Operations

### status — View PR details

No confirmation needed.

```bash
gh pr view <N> -R <R> --json number,title,state,baseRefName,headRefName,url,labels,reviewDecision,mergeStateStatus,isDraft
gh pr checks <N> -R <R>
```

Format:

```text
PR #22 (chore/multi-select-hints-and-readme) -> main
State: Open (ready for review)
CI: 3/3 passing
Reviews: 0 approved, 0 changes requested
Merge state: CLEAN
Labels: none
URL: https://github.com/JasperLabs/caruso-cli/pull/22
```

### list — List PRs

No confirmation needed.

```bash
# Org-wide (CI status not available from search)
gh search prs --author=@me --state=open --owner=JasperLabs --json repository,number,title,updatedAt,isDraft

# Single repo (CI status available)
gh pr list -R <R> --author=@me --state=open --json number,title,updatedAt,statusCheckRollup

# PRs requesting my review
gh search prs --review-requested=@me --state=open --owner=JasperLabs --json repository,number,title,updatedAt
```

Org-wide format (no CI column — use `/pr-ops ci` per PR):

```text
#     Repo                Title                          State   Updated
22    caruso-cli          Multi-select hints and README  open    2h ago
2079  entity-service      Add related party fields       draft   1d ago
```

Single-repo format (with CI):

```text
#     Title                          CI     Updated
22    Multi-select hints and README  pass   2h ago
```

### ci — Check CI status

No confirmation needed.

```bash
gh pr checks <N> -R <R>
```

Format:

```text
PR #2079 CI Status: 2/5 failing

FAIL  lint (3m12s)         https://github.com/...runs/123
FAIL  test-integration     https://github.com/...runs/124
PASS  test-unit
PASS  build
PASS  security-scan
```

### diff — Show PR diff summary

No confirmation needed.

```bash
# File list with change stats
gh pr view <N> -R <R> --json files,additions,deletions,changedFiles

# File names only (lightweight)
gh pr diff <N> -R <R> --name-only
```

Format:

```text
PR #22: 3 files changed, +45 -12

cmd/deploy.go          +12 -20
cmd/deploys.go          +0  -0
internal/pkg/config.go  +1  -1
```

Note: `gh pr diff` does NOT support `--stat`. Use `--name-only` or `gh pr view --json files`.

### draft — Convert to draft

No confirmation needed.

```bash
gh pr ready --undo <N> -R <R>
```

### ready — Mark ready for review

No confirmation needed.

```bash
gh pr ready <N> -R <R>
```

### close — Close PR without merging

**Requires confirmation.** Show PR title and state before executing.

Do NOT use `--delete-branch` with close. Branch deletion is only allowed during merge.

```bash
gh pr close <N> -R <R>
```

### reopen — Reopen a closed PR

**Requires confirmation.** Show PR title before executing.

```bash
gh pr reopen <N> -R <R>
```

### merge — Merge PR

**Requires confirmation.** Run the merge pre-flight checklist first.

**Pre-flight (run automatically before confirming):**

```bash
# Single call for draft/merge state/review status
gh pr view <N> -R <R> --json isDraft,mergeStateStatus,reviewDecision

# CI status
gh pr checks <N> -R <R>
```

Check results:

1. **isDraft** — block if true (tell user to mark ready first)
2. **CI checks** — warn if any failing/pending/no checks configured
3. **mergeStateStatus** — warn if not CLEAN (values: BEHIND, BLOCKED, DIRTY, DRAFT, HAS_HOOKS, UNKNOWN, UNSTABLE)
4. **reviewDecision** — warn if zero approvals
5. Present all findings with merge strategy (squash default)
6. Ask the user for confirmation

If user confirms:

```bash
gh pr merge <N> -R <R> --squash --delete-branch
```

Squash merge is the default (Caruso convention). Only use `--rebase` or `--merge` if explicitly asked.

Note: `--delete-branch` deletes both remote and local branch. Warn if user is in a worktree on that branch.

### update — Update PR metadata

No confirmation needed.

```bash
gh pr edit <N> -R <R> --title "<new title>"
gh pr edit <N> -R <R> --body "<new body>"
gh pr edit <N> -R <R> --add-label "<label>"
gh pr edit <N> -R <R> --remove-label "<label>"
gh pr edit <N> -R <R> --add-reviewer "<user>"
gh pr edit <N> -R <R> --base "<branch>"
```

### rerun — Re-run failed CI checks

No confirmation needed. List all failed runs and rerun each:

```bash
gh pr view <N> -R <R> --json headRefName -q .headRefName
gh run list -R <R> --branch <head-branch> --status failure --json databaseId
gh run rerun <RUN_ID> -R <R> --failed
```

If multiple failed runs exist, rerun all of them.

## Hard Rules

- **Never** force merge past failing CI (do not use `--admin` flag)
- **Never** delete branches independently of merge (`--delete-branch` only during merge, never with `close`)
- **Squash merge by default** — only use rebase/merge if explicitly asked
- **Confirm before** `merge`, `close`, `reopen`
- **Never confirm for** read-only operations, metadata updates, `draft`/`ready`, `rerun`

## Common Mistakes

- Using `gh pr diff --stat` — flag doesn't exist; use `--name-only` or `gh pr view --json files`
- Expecting CI status from `gh search prs` — not available; use `gh pr list` (single repo) or `/pr-ops ci` per PR
- Running `gh run rerun` with `--limit 1` — misses other failed workflows; list all failed runs
- Forgetting `-R` for cross-repo operations — command silently targets current repo instead

## Error Handling

- **PR not found:** "PR #N not found in JasperLabs/repo. Check the number and try again."
- **No PR on current branch:** "No PR found for branch `feat/xyz`. Create one with `gh pr create`."
- **PR already merged/closed:** Check state before attempting `merge`/`close`. Tell the user the current state.
- **Permission denied / rate limiting:** Surface the `gh` error directly.
- **Not in a git repo (and no explicit reference):** Ask the user which repo and PR number.
