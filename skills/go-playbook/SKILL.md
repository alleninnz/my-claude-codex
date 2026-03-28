---
name: go-playbook
description: Use when writing, reviewing, or refactoring Go code — covers error handling, concurrency, iterators, interfaces, testing, performance, gRPC, database patterns, and Go 1.21-1.26 features.
---

# Go Playbook (1.21-1.26)

Idiomatic Go patterns and production-ready recipes. Evidence-first: every pattern includes runnable code.

## When to Use

- Writing or reviewing Go code (error handling, concurrency, interfaces)
- Designing packages, structs, or dependency injection
- Optimizing performance (PGO, GC tuning, allocations)
- Writing tests (table-driven, fuzz, integration, benchmarks)
- Working with gRPC/Protobuf, databases, or structured logging

**Not for:** Non-Go languages, generic algorithms unrelated to Go idioms, or ops/infrastructure concerns.

## Quick Reference

| Idiom | Pattern | Section |
|-------|---------|---------|
| Error matching | `errors.AsType[*T](err)` (1.26) | Error Handling |
| Error wrapping | `fmt.Errorf("context: %w", err)` | Error Handling |
| Goroutine launch | `wg.Go(func() { ... })` (1.25) | Concurrency |
| Bounded parallelism | `conc/pool` with `WithMaxGoroutines` | Concurrency |
| Iterators | `iter.Seq[V]`, `iter.Seq2[K,V]` (1.23) | Iterators |
| HTTP routing | `mux.HandleFunc("GET /users/{id}", h)` (1.22) | Iterators |
| Test concurrency | `testing/synctest` virtual time (1.25) | Testing |
| Benchmarks | `b.Loop()` (1.24) | Testing |
| Logging | `slog` with `NewMultiHandler` (1.26) | Logging |
| Container perf | Auto GOMAXPROCS from cgroup (1.25) | Performance |
| GC | Green Tea GC default (1.26) | Performance |
| Lint | `golangci-lint v2` with `go tool` (1.24) | Tooling |
| Modernize | `go fix` with dozens of fixers (1.26) | Tooling |

## Full Reference

See @reference.md for detailed patterns, code examples, and version-specific guidance covering:

- **Error Handling** — wrapping, sentinels, custom types, `errors.AsType[T]` (1.26), anti-patterns
- **Concurrency** — `WaitGroup.Go` (1.25), conc, errgroup, context, goroutine leaks, graceful shutdown
- **Iterators & Range** — range-over-int/func (1.22-1.23), enhanced ServeMux, pull iterators
- **Go 1.24-1.26 Features** — tool directives, `b.Loop()`, `t.Context()`, `omitzero`, Swiss tables, `new(expr)`, self-referential generics, Green Tea GC, `go fix` modernizers
- **Interface Design** — consumer-defined interfaces, generics vs interfaces, optional behavior
- **Package Organization** — flat structure, internal/, dependency injection, workspaces
- **Struct Design** — functional options, method receivers, zero value usefulness
- **Testing** — table-driven, mockery v3, fuzz, testcontainers, `synctest` (1.25), `ArtifactDir` (1.26)
- **Structured Logging** — slog setup, child loggers, groups, `MultiHandler` (1.26), redaction
- **Performance** — PGO, container-aware GOMAXPROCS (1.25), Green Tea GC (1.26), sync.Pool, preallocation
- **gRPC & Protobuf** — buf toolchain, error handling, interceptors, health checks
- **Database Patterns** — ent ORM, connection pool, transactions
- **Tooling** — golangci-lint v2, `go fix` modernizers (1.26), essential commands
- **Anti-Patterns** — goroutine leaks, concurrent maps, interface pollution, context in structs
