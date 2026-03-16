# my-claude-code

Claude Code plugin that adds Go-specific agents, skills, commands, rules, and hooks. Integrates with [superpowers](https://github.com/obra/superpowers) for workflow discipline (TDD, code review, debugging, verification).

## Quick Start

1. Install the plugin:

   ```bash
   /plugin marketplace add alleninnz/my-claude-code
   /plugin install my-claude-code
   ```

2. Copy rules to your global rules directory (Claude Code cannot auto-install rules):

   ```bash
   # Find your plugin cache path
   ls ~/.claude/plugins/cache/*/my-claude-code/rules/golang

   # Copy to global rules directory
   cp -r <plugin-cache-path>/my-claude-code/rules/golang ~/.claude/rules/golang
   ```

3. (Optional) Install superpowers for workflow discipline:

   ```bash
   /plugin install superpowers@claude-plugins-official
   ```

## What You Get

### Go Code Review

`/go-review` → `go-reviewer` agent → `golang-patterns` skill

Review Go code for security vulnerabilities, concurrency bugs, error handling issues, and idiomatic patterns. Runs `go vet`, `staticcheck`, `golangci-lint`, and race detection. Issues categorized by severity (CRITICAL / HIGH / MEDIUM) with clear approval criteria.

### TDD Workflow

`/go-test` → inline TDD cycle → `golang-testing` skill

Enforces RED-GREEN-REFACTOR: define types → write table-driven tests → verify failure → implement minimal code → verify pass → check coverage (target 80%+).

### Build Fix

`/go-build` → `go-build-resolver` agent → `golang-patterns` skill

Diagnose and fix Go build errors, `go vet` warnings, and linter issues with surgical, minimal changes. One fix at a time, verify after each. Stops after 3 failed attempts to avoid blind thrashing.

### E2E Testing

`/e2e` → `e2e-runner` agent → `e2e-testing` skill

Generate and run Playwright E2E tests. Prefers Agent Browser for semantic selectors, falls back to raw Playwright. Handles flaky test quarantine and artifact management.

### CodeRabbit Review

`/cr-review` → `cr-reviewer` agent

Invoke CodeRabbit for AI-powered code review on pull requests.

### Code Simplification

`/go-simplify` → `go-simplifier` agent → `golang-patterns` skill

Simplify Go code for clarity and maintainability while preserving functionality.

### Parallel Dispatch

`/ultrawork` → runs in main context

Maximum parallelism: categorize tasks, dispatch independent agents concurrently, chain dependent tasks sequentially.

## Rules (Manual Setup Required)

Claude Code plugins cannot auto-install rules. Copy them manually:

```bash
# Find your plugin cache path
ls ~/.claude/plugins/cache/*/my-claude-code/rules/golang

# Copy to global rules directory
cp -r <plugin-cache-path>/my-claude-code/rules/golang ~/.claude/rules/golang
```

Five Go-scoped rules auto-load for `*.go`/`go.mod`/`go.sum`: coding-style, testing, security, patterns, hooks.

## Hooks

Auto-installed via plugin system. No manual setup needed.

- **Pre-commit format** — formats staged `.go`/`.proto` files before commit. Re-stages automatically.
- **Generated file guard** — warns when editing generated files. Non-blocking.

## Contexts

Three switchable modes: `dev` (code first), `research` (explore first), `review` (read-only review).

## Design: Superpowers Integration

Optional dependency — everything works without superpowers, but it adds workflow discipline.

Commands and agents invoke required skills via **Step 0** in their workflow using the Skill tool. Step 0 includes "(skip any that are unavailable)" so the plugin degrades gracefully without superpowers installed.

### Current Mappings

| Component | Step 0 invokes | superpowers skill | internal skill |
| --- | --- | --- | --- |
| /go-review, go-reviewer | Step 0 | requesting-code-review, verification-before-completion | golang-patterns |
| /go-test | Step 0 | test-driven-development | golang-testing |
| /go-build, go-build-resolver | Step 0 | systematic-debugging | golang-patterns |
| /e2e, e2e-runner | Step 0 | verification-before-completion | e2e-testing |
| /go-simplify, go-simplifier | Step 0 | — | golang-patterns |
| /ultrawork | Step 0 | dispatching-parallel-agents | — |

## License

MIT
