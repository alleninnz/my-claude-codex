# CLAUDE.md

Claude Code plugin for Go development. Provides domain-specific agents, skills, commands, rules, and hooks. Integrates with **superpowers** for workflow discipline (TDD, code review, debugging, verification).

## Install

```bash
/plugin marketplace add alleninnz/my-claude-code
/plugin install my-claude-code
```

## Architecture

```text
Command → Agent → Step 0 loads skills via Skill tool
/go-build    → go-build-resolver → systematic-debugging + golang-patterns
/go-review   → go-reviewer       → requesting-code-review + golang-patterns
/go-test     → (inline TDD)      → test-driven-development + golang-testing
/e2e         → e2e-runner        → verification-before-completion + e2e-testing
/cr-review   → cr-reviewer       → (none)
/go-simplify → go-simplifier     → golang-patterns
/ultrawork   → (main context)    → dispatching-parallel-agents
```

Commands and agents invoke required skills (superpowers + internal) via Step 0 in their workflow. Degrades gracefully without superpowers.

## Components

| Type | Items |
|------|-------|
| Agents (5) | go-reviewer, go-build-resolver, e2e-runner, cr-reviewer, go-simplifier |
| Skills (6) | golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering |
| Commands (7) | /go-build, /go-review, /go-test, /e2e, /cr-review, /go-simplify, /ultrawork |
| Rules (5) | Go-scoped: coding-style, testing, security, patterns, hooks |
| Hooks (2) | pre-commit Go/proto format, generated file guard |
| Contexts (3) | dev, research, review |

## Hooks

- **pre-commit-format.js** (PreToolUse:Bash) — formats staged `.go`/`.proto` files before `git commit`/`gt create`/`gt modify`
- **pre-edit-generated-guard.js** (PreToolUse:Edit) — warns when editing `*.pb.go`, `ent/`, `generated.go`

## Rules

```text
rules/golang/     ← auto-loads for *.go, go.mod, go.sum
```

Workflow discipline comes from superpowers. Rules provide Go conventions only (error wrapping gerund form, file size limits, security protocol, `-race` flag, hook documentation).
