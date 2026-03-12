# CLAUDE.md

This is a **Claude Code plugin** providing language-specific agents, skills, commands, and rules tailored for a Go + TypeScript + Python tech stack.

## Complements

This toolkit is designed to work alongside:
- **superpowers** — brainstorming, planning, TDD, debugging, verification workflows
- **oh-my-claudecode** — full agent catalog, orchestration modes, session management

This repo provides what those plugins don't: language-specific code review agents, tech-stack-specific skills/rules, and utility hooks.

## What's Included

- **Agents (4):** go-reviewer, go-build-resolver, database-reviewer, e2e-runner
- **Skills (14):** golang-patterns, golang-testing, frontend-patterns, python-patterns, python-testing, api-design, docker-patterns, deployment-patterns, database-migrations, postgres-patterns, e2e-testing, article-writing, agentic-engineering, ai-first-engineering
- **Commands (5):** /go-build, /go-review, /go-test, /python-review, /e2e
- **Rules (4 dirs):** common, golang, typescript, python
- **Hooks (2):** git-push reminder, JS/TS auto-format
- **Contexts (3):** dev, research, review
- **Examples (2):** Go microservice and SaaS Next.js CLAUDE.md templates
