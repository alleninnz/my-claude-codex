---
paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go Hooks

## PreToolUse Hooks (Implemented)

- **Pre-commit format**: Before `git commit`, `gt create`, `gt modify`, or `gt amend`, formats all staged `.go` files (`goimports` + `gci` + `golines`/`gofumpt`) and `.proto` files (`clang-format -style=Google`). Skips generated files. Reads GCI config from `.golangci.yml`. Re-stages formatted files automatically.
- **Generated file guard**: Warns when editing `*.pb.go`, `*_grpc.pb.go`, `*.pb.gw.go`, `generated.go`, `models_gen.go`, or `ent/` files.

## Optional Hooks (Not Implemented — Configure Manually)

- **go vet**: Run static analysis after editing `.go` files (recommended as Stop hook due to cost)
- **staticcheck**: Run extended static checks on modified packages (recommended as Stop hook)
