# Design

## Code Quality Gate

Before writing a new function or helper, check in this order:

1. Existing repo code: reuse or extend nearby code when it keeps the diff small and lowers current risk. Do not turn a narrow change into a broad refactor for minor duplication.
2. Standard library: prefer packages such as `slices`, `maps`, `strings`, `sort`, `bytes`, `cmp`, `sync`, `math/bits`, `crypto/*`, and `encoding/*`.
3. Compiler-backed stdlib functions: `bits.Len`, `bits.OnesCount`, and `sync/atomic` operations often map to optimized machine instructions.
4. Existing approved dependencies: use libraries already present in `go.mod` or local shared packages before adding custom utilities.

If one of these options directly covers the need, use it instead of writing new custom code.

If existing repo code is close but reuse would require risky cross-package churn, pause and explain the trade-off before widening scope.

Before adding a parallel function such as `fooWithX` beside `foo`, first consider whether `foo` should handle both cases through a parameter, signature change, or local shared logic. Do the local refactor when it lowers risk; ask before broad caller churn or package-boundary changes.

## Interface Design

**Small, consumer-defined interfaces:**

```go
// Define where used, not alongside implementation
// Consumer package:
type UserStore interface {
    GetUser(ctx context.Context, id string) (*User, error)
}
type Service struct { store UserStore }

// Implementation package doesn't know about this interface
// Returns concrete type:
func NewPostgresStore(db *sql.DB) *PostgresStore { ... }
```

**Generics vs interfaces:**

- Generics: operations on containers (slices, maps), data structures, type-safe utilities
- Interfaces: behavior varies per type (if calling methods that do different things)
- Don't use generics to avoid writing two functions — only when the logic is truly identical

**Optional behavior via type assertion:**

```go
type Flusher interface { Flush() error }

func WriteAndFlush(w io.Writer, data []byte) error {
    if _, err := w.Write(data); err != nil { return err }
    if f, ok := w.(Flusher); ok { return f.Flush() }
    return nil
}
```

## Package Organization

**Start flat, use internal/, skip pkg/:**

```text
myservice/
├── cmd/myservice/main.go      # entry point
├── internal/
│   ├── user/                  # domain: handler + service + store
│   ├── order/                 # domain: handler + service + store
│   └── platform/              # cross-cutting: auth, logging, config
├── proto/                     # .proto files
├── testdata/                  # test fixtures
├── go.mod
├── go.sum
└── Makefile
```

- No `pkg/` — Go team doesn't endorse it; everything outside `internal/` is public
- No grab-bag packages: `util`, `models`, `helpers`, `common`
- Domain-driven: group by business domain, not technical layer

**Dependency injection — manual first:**

```go
// main.go — the dependency graph IS the constructor call chain
func main() {
    db := connectDB()
    userStore := user.NewStore(db)
    userService := user.NewService(userStore)
    handler := user.NewHandler(userService)
    // ...
}
// Scale up: Wire (compile-time codegen) > Fx (runtime reflection)
```

**Go workspaces (multi-module local dev):**

```bash
go work init ./service-a ./service-b ./shared-lib
# go.work stays in .gitignore — dev convenience only
# CI: GOWORK=off go build ./...
```

## Struct Design

### Functional Options

```go
type Option func(*Server)

func WithPort(port int) Option { return func(s *Server) { s.port = port } }
func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }
func WithLogger(l *slog.Logger) Option { return func(s *Server) { s.logger = l } }

func NewServer(addr string, opts ...Option) *Server {
    s := &Server{addr: addr, port: 8080, timeout: 30 * time.Second, logger: slog.Default()}
    for _, opt := range opts { opt(s) }
    return s
}
```

### Method Receivers

```go
// Default: pointer receiver
// Use for: mutating state, large structs, consistency
func (s *Server) Start() error { ... }

// Value receiver: small read-only types only
// Use for: time.Time, Point{X,Y}, immutable value objects
func (p Point) Distance(other Point) float64 { ... }

// Prefer consistency: if any method needs a pointer receiver, most methods should too.
// Mixing can be acceptable for small immutable value methods; follow existing repo style.
```

### Zero Value Usefulness

```go
// Good: usable without initialization
type Counter struct {
    mu    sync.Mutex
    count int // zero = 0, ready
}
var buf bytes.Buffer  // immediately usable
var client http.Client // works with defaults

// Bad: nil map panics
type Bad struct { counts map[string]int }
```
