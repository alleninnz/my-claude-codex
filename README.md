# my-claude-codex

Claude Code and Codex plugin for Go development — shared skills and workflow helpers.

## Install

### Claude Code

```bash
/plugin marketplace add alleninnz/my-claude-codex
/plugin install my-claude-codex
```

### Codex

```bash
codex plugin marketplace add alleninnz/my-claude-codex
```

Then run `/plugins` in Codex, open the `my-claude-codex` marketplace, select `my-claude-codex`, install it, and restart Codex.

## Skills

| Skill | What it does |
|-------|-------------|
| `pr` | Create and update PRs with diff-based title/description generation |
| `resolve-pr-comments` | Interactive per-comment review of AI reviewer feedback on current PR |
| `write-articles` | Technical articles, voice capture, evidence-first writing |
| `go-playbook` | Go 1.21-1.26 patterns — error handling, concurrency, testing, performance, gRPC |
| `go-simplify` | Simplify Go code while preserving behavior; shared Claude Code/Codex skill |
| `mysql-aurora-playbook` | MySQL 8.0 & Aurora MySQL 3 patterns — indexes, types, queries, DDL, monitoring |
| `skill-guiding` | Browse and discover installed skills from user directory and marketplace plugins |
| `opsx-prompt` | Generate ticket-first `opsx:new` prompts from Linear issues, with optional deeper review |
| `implementation-discipline` | Supervise implementation against specs, prefer TDD when it fits, and checkpoint review-worthy risk boundaries |

## License

MIT
