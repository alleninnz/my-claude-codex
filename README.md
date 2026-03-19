# my-claude-code

Claude Code plugin for Go development — agents, skills, commands, rules, and hooks. Optionally integrates with [superpowers](https://github.com/obra/superpowers) for workflow discipline.

## Install

```bash
/plugin marketplace add alleninnz/my-claude-code
/plugin install my-claude-code
```

Rules require manual setup (Claude Code cannot auto-install rules):

```bash
cp -r ~/.claude/plugins/cache/*/my-claude-code/rules/golang ~/.claude/rules/golang
```

Optional — install superpowers for TDD, code review, and debugging discipline:

```bash
/plugin install superpowers@claude-plugins-official
```

## Commands

| Command | Agent | What it does |
|---------|-------|-------------|
| `/go-review` | go-reviewer | Review Go code for security, concurrency, error handling, idiomatic patterns |
| `/go-test` | (inline) | TDD workflow: table-driven tests → implement → verify 80%+ coverage |
| `/go-build` | go-build-resolver | Fix build errors, `go vet` warnings, linter issues — one fix at a time |
| `/e2e` | e2e-runner | Generate and run Playwright E2E tests |
| `/go-simplify` | go-simplifier | Simplify Go code while preserving functionality |

## Skills

Skills run in the main conversation context (no agent subprocess).

| Skill | What it does |
|-------|-------------|
| `/cr-review` | Run CodeRabbit CLI review with interactive issue selection |
| `/pr-review` | Interactive per-comment review of AI reviewer feedback on current PR |
| `/ultrawork` | Decompose tasks, route to model tiers, dispatch parallel subagents |
| `golang-patterns` | Go idioms, error handling, concurrency, interfaces, package design |
| `golang-testing` | Table-driven tests, subtests, benchmarks, fuzzing, coverage |
| `e2e-testing` | Playwright page objects, config, flaky test handling |
| `api-design` | REST/gRPC/GraphQL conventions, pagination, versioning |
| `mysql-aurora-patterns` | MySQL queries, Aurora schemas, index optimization |
| `article-writing` | Technical articles, voice capture, evidence-first writing |
| `agentic-engineering` | AI agent workflows, eval-first development, model routing |

## Hooks

Auto-installed. No manual setup.

- **Pre-commit format** — formats staged `.go`/`.proto` files before commit
- **Generated file guard** — warns when editing `*.pb.go`, `ent/`, `generated.go`

## Superpowers Integration

Optional. Everything works without it, but superpowers adds process discipline via `DEPENDENCY-GATE` blocks.

Loading order: my-claude-code skills first (domain knowledge), then superpowers skills (process framework). Skills that fail to load are marked `[SKIP]` — commands degrade gracefully.

| Component | my-claude-code skill | superpowers skill |
|-----------|---------------------|-------------------|
| /go-review, go-reviewer | golang-patterns | requesting-code-review |
| /go-test | golang-testing | test-driven-development |
| /go-build, go-build-resolver | golang-patterns | systematic-debugging |
| /e2e, e2e-runner | e2e-testing | verification-before-completion |
| /go-simplify, go-simplifier | golang-patterns | — |
| /cr-review | — | — |
| /ultrawork | — | — (self-contained) |
| /pr-review | — | — |

## License

MIT
