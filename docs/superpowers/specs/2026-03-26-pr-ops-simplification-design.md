# PR-Ops Skill Simplification

**Date:** 2026-03-26
**Status:** Draft

## Problem

The current `skills/pr-ops/SKILL.md` (252 lines) is over-designed. It acts as a `gh` CLI reference manual, encoding output format templates, error handling, and operations that Claude already handles natively. The only value this skill should provide is judgment that Claude can't derive from `gh --help`.

## Requirements

Six PR lifecycle operations:

| Operation | Behavior | Confirm? | Description gen? |
|-----------|----------|----------|-----------------|
| **create** | Creates PR as draft | No | Yes |
| **open** | Marks PR ready for review (`gh pr ready`) | No | No |
| **draft** | Converts PR to draft (`gh pr ready --undo`) | No | No |
| **close** | Closes PR without merging | Yes | No |
| **reopen** | Reopens a closed PR | Yes | No |
| **update** | Updates PR metadata; regenerates description by default | No | Yes (body only) |

## Design

### Description Generation

Source: diff-based via `git diff $(git merge-base HEAD <base>)..HEAD` where `<base>` is the PR's base branch (typically `main`).

**Title:** Conventional-commit style, imperative mood, under 70 characters. Example: `feat(auth): add session token refresh`.

**Body:** Adaptive based on diff size:

- Small diff (<100 changed lines): 1-3 bullet summary, no section headers
- Larger diff: `## Summary` (3-5 bullets) + `## Test plan` (checklist of verification steps)
- Footer: `Generated with [Claude Code](https://claude.com/claude-code)`

### Update Behavior

"Update PR" regenerates the body from the current diff. Title is preserved unless the user explicitly asks to change it.

### Confirmation Policy

- **Confirm before:** `close`, `reopen`
- **No confirmation:** `create`, `open`, `draft`, `update`

### What's Excluded

The skill intentionally does NOT cover:

- **Status/list/ci/diff/rerun/merge** — Claude handles these with native `gh` knowledge
- **Output format templates** — Claude formats output naturally
- **Error handling recipes** — Claude handles `gh` errors without guidance
- **Org-specific conventions** — no hardcoded org names, repo shortcuts, or merge strategies
- **Cross-repo shorthand** — not the skill's responsibility

### Skill Trigger

Triggers on: "create PR", "open PR", "draft PR", "close PR", "reopen PR", "update PR", "mark as ready", "convert to draft".

Does NOT trigger on: "PR status", "list PRs", "check CI", "merge PR", "rerun CI" — these don't need skill guidance.

## Size Target

~40-50 lines. The skill is a behavioral policy document, not a reference manual.
