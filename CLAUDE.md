# CLAUDE.md

This is a **Claude Code plugin** providing language-specific agents, skills, commands, and rules tailored for a Go + TypeScript tech stack.

## Complements

This toolkit is designed to work alongside:
- **superpowers** — brainstorming, planning, TDD, debugging, verification workflows
- **oh-my-claudecode** — full agent catalog, orchestration modes, session management

This repo provides what those plugins don't: language-specific code review agents, tech-stack-specific skills/rules, and utility hooks.

## What's Included

- **Agents (3):** go-reviewer, go-build-resolver, e2e-runner
- **Skills (6):** golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering
- **Commands (4):** /go-build, /go-review, /go-test, /e2e
- **Rules (3 dirs):** common, golang, typescript
- **Hooks (3):** JS/TS auto-format, pre-commit Go/proto format, generated file guard
- **Contexts (3):** dev, research, review
- **Examples (1):** Go microservice CLAUDE.md template
