# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Claude Code plugin providing Go-specific agents, skills, commands, rules, and hooks. Designed to complement **superpowers** (workflow discipline) — this repo fills the gap with tech-stack-specific domain knowledge.

## Architecture

```text
Command → Agent → Skill → superpowers discipline
/go-build  → go-build-resolver → golang-patterns → systematic-debugging
/go-review → go-reviewer       → golang-patterns → requesting-code-review
/go-test   → (inline TDD)      → golang-patterns → test-driven-development
/e2e       → e2e-runner        → e2e-testing
```

Commands explain *when*, agents define *how to behave*, skills contain *what to know*. Agents and skills cross-reference superpowers skills via `**REQUIRED BACKGROUND:**` markers (soft dependency — toolkit works without superpowers).

### Rules (Go-scoped, auto-load for `*.go`/`go.mod`/`go.sum`)

```text
rules/golang/     ← coding-style, testing, security, patterns, hooks
```

Workflow discipline (TDD, code review, debugging) comes from **superpowers**. These rules provide Go-specific conventions only.

### Hooks (2 total, wired via hooks.json)

| Hook | Trigger | What it does |
|---|---|---|
| `pre-edit-generated-guard.js` | PreToolUse:Edit | Warns (non-blocking) when editing `*.pb.go`, `ent/`, `generated.go` |
| `pre-commit-format.js` | PreToolUse:Bash | Formats staged `.go`/`.proto` files before `git commit`/`gt create`/`gt modify` |

Hook scripts use `${CLAUDE_PLUGIN_ROOT}` for path resolution. All follow stdin passthrough pattern (read raw JSON → process → write back to stdout).

## Superpowers Integration

Commands, agents, and skills use `**REQUIRED BACKGROUND:**` markers to cross-reference superpowers workflow disciplines:

| Toolkit component | superpowers skill |
|---|---|
| `/go-review`, `go-reviewer` | `requesting-code-review` |
| `/go-build`, `go-build-resolver` | `systematic-debugging` |
| `/go-test` | `test-driven-development` |
| `e2e-runner` | `verification-before-completion` |
| `golang-patterns`, `api-design` | `verification-before-completion` |
| `agentic-engineering` | `dispatching-parallel-agents` |

All skill/command/agent descriptions use superpowers-compatible `Use when...` triggers for discoverability.

## What's Included

- **Agents (3):** go-reviewer, go-build-resolver, e2e-runner
- **Skills (6):** golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering
- **Commands (4):** /go-build, /go-review, /go-test, /e2e
- **Rules (1 dir):** golang (5 files — coding-style, testing, security, patterns, hooks)
- **Hooks (2):** pre-commit Go/proto format, generated file guard
- **Contexts (3):** dev, research, review
- **Examples (1):** Go microservice CLAUDE.md template
