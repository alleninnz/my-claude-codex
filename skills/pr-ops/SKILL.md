---
name: pr-ops
description: Use when creating, opening, drafting, closing, reopening, or updating PRs. Triggers on "create PR", "open PR", "draft PR", "close PR", "reopen PR", "update PR", "mark as ready", "convert to draft". Does NOT trigger on status, list, CI, merge, or diff — Claude handles those natively.
---

# PR Operations

Six lifecycle operations with smart description generation for create and update.

## Operations

### create — Create a new PR (always draft)

1. Determine base branch: repo default (usually `main`), or user-specified
2. Get diff: `git diff $(git merge-base HEAD <base>)..HEAD`
3. Generate title: conventional-commit style, imperative mood, under 70 chars
4. Generate body (adaptive):
   - Small diff (<100 changed lines): 1-3 bullet summary
   - Larger diff: `## Summary` (3-5 bullets) + `## Test plan` (checklist)
   - Footer: `Generated with [Claude Code](https://claude.com/claude-code)`
5. Create: `gh pr create --draft --title "<title>" --body "<body>"`

### update — Regenerate PR description

1. Get base branch: `gh pr view --json baseRefName -q .baseRefName`
2. Get diff: `git diff $(git merge-base HEAD <base>)..HEAD`
3. Regenerate body using the same adaptive format as create
4. Update: `gh pr edit --body "<body>"`
5. Title is preserved unless the user explicitly asks to change it

### open — Mark ready for review

`gh pr ready`

### draft — Convert to draft

`gh pr ready --undo`

### close — Close PR (requires confirmation)

Show PR title and state, then confirm before running `gh pr close`. Never use `--delete-branch` with close.

### reopen — Reopen PR (requires confirmation)

Show PR title, then confirm before running `gh pr reopen`.

## Confirmation Policy

- **Confirm before:** `close`, `reopen`
- **No confirmation:** `create`, `open`, `draft`, `update`
