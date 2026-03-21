# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Claude Code plugin for Go development. Provides domain-specific agents, skills, commands, rules, and hooks. Integrates with **superpowers** for workflow discipline (TDD, code review, debugging, verification).

## Architecture

Two dispatch patterns:

1. **Command → Agent → Skills** — Command dispatches a subagent, which loads skills via `DEPENDENCY-GATE`
2. **Skill (main context)** — Skill runs directly in conversation for interactive workflows

```text
Pattern 1: Command → Agent → DEPENDENCY-GATE loads skills via Skill tool
/go-build    → go-build-resolver → golang-patterns + systematic-debugging
/go-review   → go-reviewer       → golang-patterns + requesting-code-review
/go-test     → (inline TDD)      → golang-testing + test-driven-development
/e2e         → e2e-runner        → e2e-testing + verification-before-completion
/go-simplify → go-simplifier     → golang-patterns

Pattern 2: Skill (main context) — no agent, runs interactively
/cr-review   → CodeRabbit CLI review with interactive issue selection
/pr-review   → interactive per-comment AI review processing
```

my-claude-code skills load first (domain knowledge), then superpowers skills (process framework). Degrades gracefully without superpowers.

## Components

| Type | Items |
|------|-------|
| Agents (4) | go-reviewer, go-build-resolver, e2e-runner, go-simplifier |
| Skills (9) | golang-patterns, golang-testing, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering, pr-review, cr-review |
| Commands (5) | /go-build, /go-review, /go-test, /e2e, /go-simplify |
| Rules (5) | Go-scoped: coding-style, testing, security, patterns, hooks |
| Hooks (2) | pre-commit Go/proto format, generated file guard |

## Hooks

- **pre-commit-format.js** (PreToolUse:Bash) — formats staged `.go`/`.proto` files before `git commit`/`gt create`/`gt modify`
- **pre-edit-generated-guard.js** (PreToolUse:Edit) — warns when editing `*.pb.go`, `ent/`, `generated.go`

## Rules

```text
rules/golang/     ← must be manually copied to ~/.claude/rules/golang
```

Rules are NOT auto-loaded by the plugin system. Users must copy them manually (see README). Once copied, they apply for `*.go`/`go.mod`/`go.sum` files. Rules provide Go conventions only (error wrapping gerund form, file size limits, security protocol, `-race` flag, hook documentation).

## Developing This Plugin

Lint markdown files after editing: `rumdl check <file>` (auto-fix: `rumdl fmt <file>`).

No build step. All components are markdown files loaded by Claude Code's plugin system. Test changes by invoking the relevant command/skill in a Claude Code session.
