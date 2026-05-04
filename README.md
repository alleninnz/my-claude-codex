# my-claude-codex

Claude Code and Codex plugin for Go development, MySQL/Aurora guidance, implementation discipline, PR workflows, opsx prompts, and technical writing.

## Install

### Claude Code

```bash
/plugin marketplace add alleninnz/my-claude-codex
/plugin install my-claude-codex
```

### Codex

```bash
codex plugin marketplace add alleninnz/my-claude-codex
codex plugin marketplace upgrade my-claude-codex
```

## Skills

| Skill | What it does |
|-------|-------------|
| `pr` | Create and update PRs with diff-based title/description generation |
| `resolve-pr-comments` | Interactive per-comment review of AI reviewer feedback on current PR |
| `write-articles` | Technical articles, voice capture, evidence-first writing |
| `go-playbook` | Go 1.21-1.26 patterns — error handling, concurrency, testing, performance, gRPC |
| `go-simplify` | Simplify Go code while preserving behavior; shared Claude Code/Codex skill |
| `mysql-aurora-playbook` | MySQL 8.0 & Aurora MySQL 3 patterns — indexes, types, queries, DDL, monitoring |
| `opsx-prompt` | Generate ticket-first `opsx:new` prompts from Linear issues, with optional deeper review |
| `pause-for-review` | Decision boundaries where agents stop code generation for user review — direction, contract, reversibility, discovery, slice-complete — with a pause-output template |

## License

MIT
