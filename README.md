# my-claude-code

Claude Code plugin for Go development. Agents, skills, commands, rules, and hooks with [superpowers](https://github.com/anthropics/claude-code-plugins) integration.

## Install

```bash
/plugin marketplace add alleninnz/my-claude-code
/plugin install my-claude-code
```

## What's Included

| Type | Items |
|------|-------|
| Agents (5) | go-reviewer, go-build-resolver, e2e-runner, cr-reviewer, go-simplifier |
| Skills (6) | golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering |
| Commands (6) | /go-build, /go-review, /go-test, /e2e, /cr-review, /go-simplify |
| Rules (5) | Go-scoped: coding-style, testing, security, patterns, hooks |
| Hooks (2) | pre-commit Go/proto format, generated file guard |
| Contexts (3) | dev, research, review |

## Superpowers Integration

Cross-references via `**REQUIRED BACKGROUND:**` markers (soft dependency):

| Component | superpowers skill |
|---|---|
| /go-review, go-reviewer | requesting-code-review |
| /go-build, go-build-resolver | systematic-debugging |
| /go-test | test-driven-development |
| e2e-runner | verification-before-completion |
| /cr-review, cr-reviewer | (none -- CodeRabbit is the reviewer) |
| /go-simplify, go-simplifier | (none -- uses golang-patterns skill directly) |
| golang-patterns, api-design | verification-before-completion |
| agentic-engineering | dispatching-parallel-agents |

## Hooks

**Pre-commit format** — formats staged `.go` (goimports + gci + golines/gofumpt) and `.proto` (clang-format) files before commit. Re-stages automatically.

**Generated file guard** — warns when editing generated files (`*.pb.go`, `ent/`, `generated.go`, `models_gen.go`). Non-blocking.
