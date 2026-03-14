# my-claude-toolkit

Claude Code plugin for Go development. Provides domain-specific agents, skills, commands, rules, and hooks. Integrates with [superpowers](https://github.com/anthropics/claude-code-plugins) for workflow discipline (TDD, code review, debugging).

## Install

Add as a Claude Code plugin:

```bash
claude plugins add /path/to/my-claude-toolkit
```

Or copy rules manually:

```bash
cp -r rules/golang ~/.claude/rules/golang
```

## What's Included

| Type | Count | Items |
|------|-------|-------|
| Agents | 3 | go-reviewer, go-build-resolver, e2e-runner |
| Skills | 6 | golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering |
| Commands | 4 | /go-build, /go-review, /go-test, /e2e |
| Rules | 5 files | Go-scoped (coding-style, testing, security, patterns, hooks) |
| Hooks | 2 | pre-commit Go/proto format, generated file guard |
| Contexts | 3 | dev, research, review |

## Superpowers Integration

Commands, agents, and skills cross-reference superpowers workflow disciplines via `**REQUIRED BACKGROUND:**` markers:

| Toolkit component | superpowers skill |
|---|---|
| `/go-review`, `go-reviewer` | `requesting-code-review` |
| `/go-build`, `go-build-resolver` | `systematic-debugging` |
| `/go-test` | `test-driven-development` |
| `e2e-runner` | `verification-before-completion` |
| `golang-patterns`, `api-design` | `verification-before-completion` |
| `agentic-engineering` | `dispatching-parallel-agents` |

Markers are soft dependencies — the toolkit works without superpowers installed. All descriptions use `Use when...` triggers for superpowers-compatible discoverability.

## Hooks

**Pre-commit format** — Before `git commit`, `gt create`, `gt modify`, or `gt amend`, formats all staged `.go` files (goimports + gci + golines/gofumpt) and `.proto` files (clang-format). Reads GCI config from `.golangci.yml`. Re-stages formatted files.

**Generated file guard** — Warns when editing generated files (`*.pb.go`, `*_grpc.pb.go`, `ent/`, `generated.go`, `models_gen.go`). Non-blocking.

## Complements

Designed to work alongside [superpowers](https://github.com/anthropics/claude-code-plugins) — brainstorming, planning, TDD, code review, debugging, and verification workflows.
