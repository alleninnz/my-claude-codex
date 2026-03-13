# my-claude-toolkit

Claude Code plugin for Go + TypeScript development. Provides language-specific agents, skills, commands, rules, and hooks.

## Install

Add as a Claude Code plugin:

```bash
claude plugins add /path/to/my-claude-toolkit
```

Or copy rules manually:

```bash
cp -r rules/common ~/.claude/rules/common
cp -r rules/golang ~/.claude/rules/golang
cp -r rules/typescript ~/.claude/rules/typescript
```

## What's Included

| Type | Count | Items |
|------|-------|-------|
| Agents | 3 | go-reviewer, go-build-resolver, e2e-runner |
| Skills | 6 | golang-patterns, api-design, mysql-aurora-patterns, e2e-testing, article-writing, agentic-engineering |
| Commands | 4 | /go-build, /go-review, /go-test, /e2e |
| Rules | 3 dirs | common, golang, typescript |
| Hooks | 3 | JS/TS auto-format, pre-commit Go/proto format, generated file guard |
| Contexts | 3 | dev, research, review |

## Hooks

**Pre-commit format** — Before `git commit`, `gt create`, `gt modify`, or `gt amend`, formats all staged `.go` files (goimports + gci + golines/gofumpt) and `.proto` files (clang-format). Reads GCI config from `.golangci.yml`. Re-stages formatted files.

**Generated file guard** — Warns when editing generated files (`*.pb.go`, `*_grpc.pb.go`, `ent/`, `generated.go`, `models_gen.go`). Non-blocking.

**JS/TS auto-format** — After each Edit, auto-formats `.ts/.tsx/.js/.jsx` files with Biome (preferred) or Prettier.

## Complements

Designed to work alongside:
- [superpowers](https://github.com/anthropics/claude-code-plugins) — brainstorming, planning, TDD, debugging workflows
- [oh-my-claudecode](https://github.com/anthropics/oh-my-claudecode) — agent orchestration, session management
