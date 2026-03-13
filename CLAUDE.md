# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Claude Code plugin providing language-specific agents, skills, commands, rules, and hooks for a Go + TypeScript tech stack. Designed to complement **superpowers** (workflows) and **oh-my-claudecode** (orchestration) — this repo fills the gap with tech-stack-specific tooling.

## Architecture

```
Command → Agent → Skill
/go-build  → go-build-resolver → golang-patterns
/go-review → go-reviewer       → golang-patterns
/go-test   → (inline TDD)      → golang-patterns
/e2e       → e2e-runner        → e2e-testing
```

Commands explain *when*, agents define *how to behave*, skills contain *what to know*.

### Layered Rules (CSS-like cascade)

```
rules/common/     ← universal defaults (always active)
rules/golang/     ← extends common for Go projects
rules/typescript/ ← extends common for TS projects
```

Language-specific rules override common rules. File names mirror across layers (`coding-style.md`, `testing.md`, etc.).

### Hooks (3 total, wired via hooks.json)

| Hook | Trigger | What it does |
|---|---|---|
| `pre-edit-generated-guard.js` | PreToolUse:Edit | Warns (non-blocking) when editing `*.pb.go`, `ent/`, `generated.go` |
| `pre-commit-format.js` | PreToolUse:Bash | Formats staged `.go`/`.proto` files before `git commit`/`gt create`/`gt modify` |
| `post-edit-format.js` | PostToolUse:Edit | Auto-formats JS/TS files with Biome or Prettier |

Hook scripts use `${CLAUDE_PLUGIN_ROOT}` for path resolution. All follow stdin passthrough pattern (read raw JSON → process → write back to stdout).

## What's Included

- **Agents (3):** go-reviewer, go-build-resolver, e2e-runner
- **Skills (6):** golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering
- **Commands (4):** /go-build, /go-review, /go-test, /e2e
- **Rules (3 dirs):** common (9 files), golang (5 files), typescript (5 files)
- **Hooks (3):** JS/TS auto-format, pre-commit Go/proto format, generated file guard
- **Contexts (3):** dev, research, review
- **Examples (1):** Go microservice CLAUDE.md template
