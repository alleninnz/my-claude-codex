---
name: cr-review
description: Use when running CodeRabbit CLI to review code changes before push, or when the user says "cr review", "coderabbit", "cr-review".
---

# CodeRabbit Review

Run CodeRabbit CLI as an independent AI code reviewer. Auto-detects review scope, summarizes findings by severity, and fixes user-selected issues.

## Prerequisites

- CodeRabbit CLI installed (`npm install -g coderabbit`)
- Authenticated (`cr auth`)
- `gh` CLI for PR base branch detection

## Step 1 — Auto-detect review scope

Run `git status --porcelain` to determine scope:

| State | Command |
|-------|---------|
| Uncommitted changes exist | `cr review --prompt-only --no-color --type uncommitted` |
| All committed, PR exists | `cr review --prompt-only --no-color --base <pr-base-branch>` |
| All committed, no PR | `cr review --prompt-only --no-color --base main` |

For PR base branch: `gh pr view --json baseRefName -q .baseRefName`

Handle failures: `cr` not found → install instructions, auth failure → `cr auth`, no files → stop, network error → stop.

## Step 2 — Summarize findings

The `--prompt-only` output is raw analysis text. Parse it and present a **categorized summary only** — do NOT paste the raw CodeRabbit output into the conversation (it pollutes context).

```
CodeRabbit found N issues:

CRITICAL (X):
1. [file:line] description

HIGH (X):
2. [file:line] description

MEDIUM (X):
3. [file:line] description

Which issues to fix? (all / 1,2,3 / none):
```

If no issues found, report and stop.

## Step 3 — Fix selected issues

Based on user selection: read the relevant source files, apply fixes one by one, briefly explain each change. Do NOT commit.

## Common mistakes

- **Dumping raw CR output** — Only show the categorized summary. Raw output wastes context tokens.
- **Committing fixes** — Never. User handles git workflow.
- **Running go vet / staticcheck** — That's `/go-review`, not this skill.
