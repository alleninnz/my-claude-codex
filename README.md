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
| Agents (3) | go-reviewer, go-build-resolver, e2e-runner |
| Skills (6) | golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering |
| Commands (4) | /go-build, /go-review, /go-test, /e2e |
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
| golang-patterns, api-design | verification-before-completion |
| agentic-engineering | dispatching-parallel-agents |

## Hooks

**Pre-commit format** — formats staged `.go` (goimports + gci + golines/gofumpt) and `.proto` (clang-format) files before commit. Re-stages automatically.

**Generated file guard** — warns when editing generated files (`*.pb.go`, `ent/`, `generated.go`, `models_gen.go`). Non-blocking.
