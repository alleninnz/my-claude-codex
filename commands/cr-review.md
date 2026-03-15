---
description: Use when running CodeRabbit CLI to review code changes before push.
  Auto-detects scope -- reviews uncommitted changes if any, otherwise reviews full PR diff.
---

# CodeRabbit Review

This command invokes the **cr-reviewer** agent to run CodeRabbit CLI as an independent AI code reviewer.

## What This Command Does

1. **Auto-detect scope**: Checks for uncommitted changes or falls back to PR diff
2. **Run CodeRabbit CLI**: Executes `cr review --prompt-only` to get AI analysis
3. **Summarize findings**: Categorizes issues by severity (CRITICAL/HIGH/MEDIUM)
4. **Fix after confirmation**: User selects which issues to fix, agent applies changes

## Auto-Detect Behavior

| State | What gets reviewed |
|-------|-------------------|
| Uncommitted changes exist (staged or unstaged) | `cr review --type uncommitted` |
| Everything committed, PR exists | `cr review --base <pr-base-branch>` |
| Everything committed, no PR | `cr review --base main` |

## Usage

```text
/cr-review
```

No arguments needed. Scope is detected automatically.

## Prerequisites

- CodeRabbit CLI installed (`npm install -g coderabbit`)
- Authenticated (`cr auth`)
- `gh` CLI for PR base branch detection

## Complementary to /go-review

| Command | Reviewer | Focus |
|---------|----------|-------|
| `/go-review` | Claude (go-reviewer) | Go-specific: race conditions, error handling, idioms |
| `/cr-review` | CodeRabbit (external AI) | Language-agnostic: logic errors, security, design issues |

Use both for double review coverage, or either independently.

## Suggested Workflow

1. `/go-test` -- ensure tests pass
2. `/cr-review` -- CodeRabbit AI review
3. `/go-review` -- Go-specific review
4. Commit and push

## Related

- Agent: `agents/cr-reviewer.md`
