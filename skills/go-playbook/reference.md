# Go Playbook Reference (1.21-1.26)

## Error Handling

**Wrap with context — always use `%w` unless deliberately hiding internals:**

```go
// Good: callers can unwrap
return fmt.Errorf("get user %q: %w", id, err)

// Opaque: callers cannot unwrap (use at API boundaries)
return fmt.Errorf("get user %q: %v", id, err)
```

**Multiple causes (1.20+):**

```go
err := fmt.Errorf("op failed: %w and %w", err1, err2)
err := errors.Join(validationErr, networkErr)
// errors.Is / errors.As traverse the full tree
```

**Sentinel vs custom types — decision tree:**

```go
// Sentinel: static condition, identity-based matching
var ErrNotFound = errors.New("not found")
if errors.Is(err, ErrNotFound) { ... }

// Custom type: callers need structured data beyond identity
type ValidationError struct { Field, Message string }
func (e *ValidationError) Error() string { ... }

var ve *ValidationError
if errors.As(err, &ve) { ... }
```

**Generic error matching (1.26+) — type-safe, no pointer variable needed:**

```go
// Old: requires pre-declared variable
var ve *ValidationError
if errors.As(err, &ve) { handleValidation(ve) }

// New (1.26): generic, returns value directly
if ve, ok := errors.AsType[*ValidationError](err); ok {
    handleValidation(ve)
}
```

**Anti-patterns:**

- Don't log AND return the same error — handle it once
- Don't add redundant "failed to" prefixes — they pile up through call chain
- Don't `_ = fn()` — errcheck linter catches this
- Don't use `panic` for expected error conditions
- Don't compare with `==` or `.Error()` string — always `errors.Is`/`errors.As`

## Concurrency

### WaitGroup.Go (1.25+)

Replaces the `wg.Add(1)` + `go func() { defer wg.Done() }()` boilerplate:

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Go(func() { process(item) })
}
wg.Wait()
```

### Loop Variable Fix (1.22+)

For-loop variables are now **per-iteration scoped**. The `i, url := i, url` idiom is dead:

```go
// Go 1.22+: each goroutine correctly captures its own v
for _, v := range values {
    go func() { fmt.Println(v) }()
}
// Requires `go 1.22` or later in go.mod
```

### conc (sourcegraph/conc) — recommended for production

```go
import "github.com/sourcegraph/conc/pool"

// Bounded parallelism with error collection
func processItems(ctx context.Context, items []Item) error {
    p := pool.New().WithMaxGoroutines(10).WithErrors().WithContext(ctx)
    for _, item := range items {
        p.Go(func(ctx context.Context) error {
            return process(ctx, item)
        })
    }
    return p.Wait()
}

// Collecting typed results
func fetchAll(ctx context.Context, ids []string) ([]Result, error) {
    p := pool.NewWithResults[Result]().WithErrors().WithContext(ctx)
    for _, id := range ids {
        p.Go(func(ctx context.Context) (Result, error) {
            return fetch(ctx, id)
        })
    }
    return p.Wait()
}
```

**conc vs errgroup vs WaitGroup:**

| Feature | sync.WaitGroup | errgroup | conc |
|---------|---------------|----------|------|
| Error handling | Manual | First error | First or all |
| Panic recovery | No | No | Yes + child stack traces |
| Concurrency limit | No | SetLimit | WithMaxGoroutines |
| Result collection | No | No | ResultPool |
| Goroutine launch | `.Go(func())` (1.25) | `.Go(func() error)` | `.Go(func(ctx) error)` |

Use WaitGroup for simplest fire-and-forget. Use errgroup for stdlib-adjacent error propagation + context cancellation. Use conc when you need panic safety, result collection, or ordered streaming.

### errgroup (stdlib alternative)

```go
import "golang.org/x/sync/errgroup"

func FetchAll(ctx context.Context, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([][]byte, len(urls))

    for i, url := range urls {
        g.Go(func() error {
            data, err := fetch(ctx, url)
            if err != nil { return err }
            results[i] = data
            return nil
        })
    }
    return results, g.Wait()
}
```

### Context (1.21+)

```go
// WithoutCancel: decouple from parent cancellation
// Use for fire-and-forget work after HTTP handler returns
ctx := context.WithoutCancel(parentCtx)

// AfterFunc: schedule cleanup on context cancellation
stop := context.AfterFunc(ctx, func() {
    conn.Close() // runs in its own goroutine when ctx is done
})
defer stop()

// Timeouts
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
```

### Goroutine Leak Prevention

```go
// Bad: blocks forever if no receiver
ch := make(chan []byte)
go func() { ch <- fetch(url) }()

// Good: buffered channel + context check
ch := make(chan []byte, 1)
go func() {
    data, err := fetch(url)
    if err != nil { return }
    select {
    case ch <- data:
    case <-ctx.Done():
    }
}()

// In tests: use uber-go/goleak
func TestMain(m *testing.M) { goleak.VerifyTestMain(m) }

// Experimental (1.26): goroutine leak profile
// GOEXPERIMENT=goroutineleakprofile
// Detects goroutines blocked on unreachable concurrency primitives
// Available at /debug/pprof/goroutineleak
```

### Graceful Shutdown

```go
func GracefulShutdown(server *http.Server) {
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    if err := server.Shutdown(ctx); err != nil {
        slog.Error("Server forced shutdown", "error", err)
    }
}
```

## Iterators & Range (1.22-1.23)

### Range-over-int (1.22+)

```go
for i := range 10 { fmt.Println(i) } // 0..9
```

### Range-over-func (1.23+)

```go
// iter.Seq[V] = func(yield func(V) bool)
// iter.Seq2[K, V] = func(yield func(K, V) bool)

// Custom iterator
func Backward[E any](s []E) iter.Seq2[int, E] {
    return func(yield func(int, E) bool) {
        for i := len(s) - 1; i >= 0; i-- {
            if !yield(i, s[i]) { return }
        }
    }
}
for i, v := range Backward(mySlice) { ... }

// Compose stdlib iterators
for _, key := range slices.Sorted(maps.Keys(m)) { ... }

// Pull iterator: convert push to on-demand next/stop
next, stop := iter.Pull(mySeq)
defer stop() // ALWAYS defer stop to prevent goroutine leak
v, ok := next()
```

**Convention:** collection methods returning all elements use `.All()`.

### Enhanced ServeMux (1.22+)

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    // ...
})
mux.HandleFunc("POST /users", createUser)
mux.HandleFunc("GET /files/{path...}", serveFile) // wildcard rest
// Precedence: more specific patterns win
// "GET /users/admin" beats "GET /users/{id}"
// Note (1.26): trailing slash redirects now use 307 instead of 301
```

## Go 1.24-1.26 Features

### Tool Directives (1.24 — replaces tools.go hack)

```text
// go.mod
tool (
    golang.org/x/tools/cmd/stringer
    github.com/golangci/golangci-lint/v2/cmd/golangci-lint
    github.com/vektra/mockery/v2
)
```

```bash
go tool stringer -type=Status    # run tool
go get -tool example.com/cmd/foo # add tool dependency
```

### testing.B.Loop (1.24+, improved 1.26)

```go
// Old: compiler can optimize away, timer issues
func BenchmarkOld(b *testing.B) {
    for i := 0; i < b.N; i++ { process(data) }
}

// New (1.24): prevents dead-code elimination, auto-manages timer
// 1.26: no longer prevents inlining — more accurate results
func BenchmarkNew(b *testing.B) {
    data := setup() // runs once, excluded from timing
    for b.Loop() {
        process(data)
    }
}
```

### Other 1.24 highlights

```go
// t.Context(): auto-cancelled when test completes
func TestFoo(t *testing.T) {
    ctx := t.Context()
    result, err := fetchWithContext(ctx, "...")
}

// json:"omitzero" — zero-value-aware omission (unlike omitempty)
type Config struct {
    Retries int `json:"retries,omitzero"` // omits 0, not just empty
}

// Swiss Tables map: ~30% faster access, ~60% faster iteration, free upgrade
// Just set `go 1.24` in go.mod

// weak.Pointer: memory-efficient caches without preventing GC
ptr := weak.Make(&expensiveObj)
if val := ptr.Value(); val != nil { use(val) }
```

### Go 1.25 highlights

```go
// sync.WaitGroup.Go — see Concurrency section for full example
// testing/synctest — see Testing section for full example

// Container-aware GOMAXPROCS: runtime respects cgroup CPU limits on Linux
// Auto-updates if limits change. Disable: GODEBUG=containermaxprocs=0

// Trace flight recorder: lightweight continuous tracing
recorder := trace.NewFlightRecorder()
// ... on significant event:
recorder.WriteTo(file) // dump recent trace

// slog.GroupAttrs: create group Attr from attr slice
slog.Info("request", slog.GroupAttrs("http", attrs...))

// net/http.CrossOriginProtection: CSRF protection using Fetch metadata
// No tokens or cookies needed

// go.mod ignore directive: exclude directories from package matching
// Vet: new waitgroup analyzer catches misplaced Add calls
// Vet: new hostport analyzer suggests net.JoinHostPort for IPv6
```

### Go 1.26 highlights

```go
// new(expr): new builtin accepts expressions
type Person struct { Name string; Age *int }
p := Person{Name: "Alice", Age: new(42)} // instead of: tmp := 42; &tmp

// Self-referential generic types
type Adder[A Adder[A]] interface { Add(A) A }

// errors.AsType[T] — see Error Handling section for full example
// Green Tea GC — see Performance section for details
// go fix modernizers — see Tooling section for details
// slog.NewMultiHandler, T.ArtifactDir — see dedicated sections

// reflect iterator methods: Type.Fields(), Type.Methods(), etc.
// cgo: ~30% faster baseline overhead
// Heap base address randomization on 64-bit (security)
// Compiler: more stack allocation for slice backing stores
// io.ReadAll: ~2x faster, less intermediate memory
// crypto/tls: post-quantum hybrid key exchanges enabled by default
```

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

// NEVER mix: if any method needs pointer, use pointer for ALL
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

## Testing

### Table-Driven Tests

```go
func TestParseStatus(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    Status
        wantErr bool
    }{
        {name: "valid active", input: "active", want: StatusActive},
        {name: "empty string", input: "", wantErr: true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseStatus(tt.input)
            if tt.wantErr {
                require.Error(t, err)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

### testing/synctest (1.25+ — virtual time)

```go
import "testing/synctest"

func TestConcurrentTimeout(t *testing.T) {
    synctest.Test(func() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        go worker(ctx)
        // Time advances instantly when all goroutines block
        synctest.Wait() // wait for all goroutines to reach a blocking point
        // Assert state after virtual time elapses
    })
}
```

### Mocking (mockery v3)

```yaml
# .mockery.yaml
packages:
  github.com/myorg/myapp/internal/user:
    interfaces:
      Store:
        config:
          mockname: MockStore
          outpkg: mocks
```

```bash
go tool mockery  # generates mocks via go 1.24 tool directive
```

### Fuzz Testing

```go
func FuzzParseJSON(f *testing.F) {
    f.Add([]byte(`{"name":"test"}`))
    f.Add([]byte(`{}`))
    f.Fuzz(func(t *testing.T, data []byte) {
        result, err := ParseJSON(data)
        if err != nil { return } // invalid input is fine
        // re-encode and check round-trip
        encoded, err := json.Marshal(result)
        require.NoError(t, err)
        assert.JSONEq(t, string(data), string(encoded))
    })
}
```

### Integration with testcontainers

```go
func TestUserStore(t *testing.T) {
    ctx := t.Context() // 1.24: auto-cancelled when test ends
    container, err := mysql.Run(ctx, "mysql:8.0",
        mysql.WithDatabase("test"), mysql.WithUsername("root"), mysql.WithPassword("test"))
    require.NoError(t, err)
    t.Cleanup(func() { container.Terminate(context.Background()) })

    dsn, _ := container.ConnectionString(ctx)
    db, _ := sql.Open("mysql", dsn)
    store := user.NewStore(db)
    // ... test against real MySQL
}
```

### Test Artifacts (1.26+)

```go
func TestGenerate(t *testing.T) {
    dir := t.ArtifactDir() // dedicated directory for test output files
    // Write test artifacts (screenshots, generated files, etc.)
    os.WriteFile(filepath.Join(dir, "output.json"), data, 0o644)
}
// Run: go test -outputdir=./testoutput ./...
// ArtifactDir creates a subdirectory under -outputdir for each test
```

## Structured Logging (slog, 1.21+)

```go
// Setup: JSON handler for production
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo, AddSource: true,
}))
slog.SetDefault(logger)

// Basic usage
slog.Info("request completed", "method", "GET", "status", 200, "duration_ms", 45)

// Child logger with persistent context
reqLogger := slog.With("request_id", reqID, "user_id", userID)
reqLogger.Info("Processing order", "order_id", orderID)

// Grouped attributes for nested JSON
slog.Info("request", slog.Group("http",
    slog.String("method", r.Method),
    slog.Int("status", code),
))
// {"http":{"method":"GET","status":200}}

// GroupAttrs (1.25): create group from attr slice
slog.Info("request", slog.GroupAttrs("http", attrs...))

// MultiHandler (1.26): fan out to multiple backends
handler := slog.NewMultiHandler(jsonHandler, sentryHandler)
logger := slog.New(handler)

// Hot path: avoid reflection with LogAttrs
logger.LogAttrs(ctx, slog.LevelInfo, "processed",
    slog.String("id", id), slog.Duration("took", elapsed))

// Sensitive data redaction via LogValuer
type Token string
func (t Token) LogValue() slog.Value { return slog.StringValue("REDACTED") }
```

**slog vs zap vs zerolog:**

- slog: default for new projects (zero deps, Handler interface for backends)
- zerolog: raw performance winner (zero-allocation)
- zap: high customization via zapcore
- Pragmatic: slog frontend + high-perf backend handler (slogzap/slogzerolog)

## Performance

### PGO (Profile-Guided Optimization, 1.21+ GA)

```bash
# 1. Collect 30s CPU profile from production
curl -s http://localhost:6060/debug/pprof/profile?seconds=30 > default.pgo
# 2. Place default.pgo in main package directory
# 3. Rebuild — 2-14% speedup from aggressive inlining + devirtualization
go build -o myservice ./cmd/myservice
# Commit default.pgo to version control for reproducible builds
```

### Container-Aware GOMAXPROCS (1.25+)

```go
// Runtime now automatically respects cgroup CPU bandwidth limits on Linux
// Periodically updates GOMAXPROCS if limits change (e.g., vertical scaling)
// Replaces the need for uber-go/automaxprocs in most cases

// Disable if needed:
// GODEBUG=containermaxprocs=0  (disable cgroup awareness)
// GODEBUG=updatemaxprocs=0     (disable periodic updates)
// Or set GOMAXPROCS env var / call runtime.GOMAXPROCS() to override
```

### Green Tea GC (1.26 default)

- 10-40% reduction in GC overhead via improved small-object locality
- Additional 10% on newer CPUs (Ice Lake+, Zen 4+) via vector instructions
- Free upgrade — just set `go 1.26` in go.mod
- Disable: `GOEXPERIMENT=nogreenteagc` (opt-out expected removed in 1.27)

### GOGC / GOMEMLIMIT (container tuning)

```dockerfile
# ECS task definition / Dockerfile
ENV GOMEMLIMIT=460MiB   # ~90% of 512MiB container
ENV GOGC=100             # or GOGC=off with GOMEMLIMIT for max throughput
```

### sync.Pool

```go
var bufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

func Process(data []byte) []byte {
    buf := bufPool.Get().(*bytes.Buffer)
    defer func() { buf.Reset(); bufPool.Put(buf) }()
    buf.Write(data)
    return buf.Bytes()
}
// Use when: allocation rate >1000/sec for short-lived objects
// Never: store references to pooled objects after Put
```

### Preallocation

```go
// Slices: single allocation
results := make([]Result, 0, len(items))

// Maps: avoid rehashing
m := make(map[string]int, expectedSize)

// strings.Builder: pre-grow
var sb strings.Builder
sb.Grow(estimatedSize)
```

### Escape Analysis

```bash
go build -gcflags='-m' ./...  # check allocations
```

Common heap-escape causes: returning pointers, closure captures in goroutines, interface assignments, objects >~64KB. In hot paths: return by value, pass params explicitly to goroutines.

Note (1.25-1.26): compiler now allocates slice backing stores on stack in more situations — free performance improvement.

## gRPC & Protobuf

### Buf toolchain

```yaml
# buf.yaml
version: v2
modules:
  - path: proto
lint:
  use: [DEFAULT]
breaking:
  use: [FILE]
```

```yaml
# buf.gen.yaml
version: v2
plugins:
  - remote: buf.build/protocolbuffers/go
    out: gen/go
    opt: paths=source_relative
  - remote: buf.build/grpc/go
    out: gen/go
    opt: paths=source_relative
```

```bash
buf lint
buf breaking --against '.git#branch=main'
buf generate
buf format -w
```

### gRPC Error Handling

```go
import (
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
    "google.golang.org/genproto/googleapis/rpc/errdetails"
)

// Server: return status errors
func (s *Server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
    user, err := s.store.Get(ctx, req.Id)
    if errors.Is(err, ErrNotFound) {
        return nil, status.Error(codes.NotFound, "user not found")
    }
    if err != nil {
        return nil, status.Error(codes.Internal, "internal error")
    }
    return &pb.GetUserResponse{User: user}, nil
}

// Rich errors with details
st := status.New(codes.InvalidArgument, "invalid request")
st, _ = st.WithDetails(&errdetails.BadRequest{
    FieldViolations: []*errdetails.BadRequest_FieldViolation{
        {Field: "email", Description: "must be valid email"},
    },
})
return nil, st.Err()

// Client: extract status
st, ok := status.FromError(err)
if ok && st.Code() == codes.NotFound { ... }
```

### Interceptor Chain

```go
// Sub-packages from github.com/grpc-ecosystem/go-grpc-middleware/v2
server := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        otelgrpc.UnaryServerInterceptor(),    // tracing
        logging.UnaryServerInterceptor(logger), // logging
        recovery.UnaryServerInterceptor(),      // panic → codes.Internal
        auth.UnaryServerInterceptor(authFn),    // authentication
    ),
)
```

### Health Check

```go
import "google.golang.org/grpc/health"
import healthpb "google.golang.org/grpc/health/grpc_health_v1"

healthServer := health.NewServer()
healthpb.RegisterHealthServer(grpcServer, healthServer)
healthServer.SetServingStatus("myservice", healthpb.HealthCheckResponse_SERVING)
```

## Database Patterns

### Ent ORM

```go
// Schema-as-code
func (User) Fields() []ent.Field {
    return []ent.Field{
        field.String("name").NotEmpty(),
        field.String("email").Unique(),
        field.Time("created_at").Default(time.Now).Immutable(),
    }
}

// Eager loading (avoid N+1)
users, err := client.User.Query().
    WithOrders(func(q *ent.OrderQuery) {
        q.WithItems() // nested eager load
    }).
    Where(user.StatusEQ(user.StatusActive)).
    All(ctx)

// Transaction
tx, err := client.Tx(ctx)
if err != nil { return err }
defer tx.Rollback() // no-op after commit
// ... operations on tx ...
return tx.Commit()
```

### Connection Pool (database/sql)

```go
db.SetMaxOpenConns(25)                 // ALWAYS set — default 0 = unlimited
db.SetMaxIdleConns(25)                 // match MaxOpenConns for steady load
db.SetConnMaxLifetime(5 * time.Minute) // below MySQL wait_timeout
db.SetConnMaxIdleTime(5 * time.Minute)
// Always use *Context variants: QueryContext, ExecContext
```

### Transaction Pattern

```go
// Repository owns the transaction boundary
func (r *Repo) TransferFunds(ctx context.Context, from, to string, amount int) error {
    tx, err := r.db.BeginTx(ctx, nil)
    if err != nil { return fmt.Errorf("begin tx: %w", err) }
    defer tx.Rollback()

    if _, err := tx.ExecContext(ctx, "UPDATE accounts SET balance = balance - ? WHERE id = ?", amount, from); err != nil {
        return fmt.Errorf("debit: %w", err)
    }
    if _, err := tx.ExecContext(ctx, "UPDATE accounts SET balance = balance + ? WHERE id = ?", amount, to); err != nil {
        return fmt.Errorf("credit: %w", err)
    }
    return tx.Commit()
}
```

## Tooling

### golangci-lint v2 (.golangci.yml)

```yaml
version: "2"
formatters:
  enable: [goimports, golines]
  settings:
    golines: { max-len: 120 }
    goimports: { local-prefixes: github.com/myorg }
linters:
  default: all
  disable:
    - depguard
    - exhaustruct
  settings:
    govet: { enable-all: true }
    errcheck: { check-type-assertions: true }
    revive:
      rules:
        - name: unexported-return
          disabled: true
```

### go fix Modernizers (1.26+)

```bash
# Rewritten with dozens of automated fixers for modern Go idioms
go fix ./...

# Uses Go analysis framework (same as go vet)
# Source-level inliner with //go:fix inline directives
# Safely migrates code to use newer APIs and patterns
```

### Essential Commands

```bash
# Format (gofumpt = stricter gofmt, de facto standard)
gofumpt -w .
golines -w --max-len=120 .
gci write -s standard -s default -s "prefix(github.com/myorg)" .

# Lint
golangci-lint run

# Test
go test -race -count=1 ./...
go test -cover -coverprofile=coverage.out ./...
go test -fuzz=FuzzParseJSON -fuzztime=30s ./...

# Build (auto-discovers default.pgo in main package dir)
go build -o bin/myservice ./cmd/myservice

# Modernize (1.26+)
go fix ./...

# Escape analysis
go build -gcflags='-m' ./...
```

## Anti-Patterns

```go
// ❌ Goroutine leak: no cancellation mechanism
go func() { for { processQueue() } }()
// ✅ Always: context cancellation, WaitGroup, or channel close

// ❌ Concurrent map access: unrecoverable panic
go func() { m["key"] = "val" }()
// ✅ sync.RWMutex or sync.Map

// ❌ Interface pollution: defining alongside implementation
type Store interface { ... } // in the same package as PostgresStore
// ✅ Define interfaces at the consumer, not the provider

// ❌ Context in struct
type Request struct { ctx context.Context; ID string }
// ✅ Context as first parameter
func Process(ctx context.Context, id string) error { ... }

// ❌ init() overuse: hidden side effects, hard to test
func init() { db, _ = sql.Open(...) }
// ✅ Explicit initialization in main() or constructors

// ❌ Naked returns in long functions
func process() (result int, err error) { /* 50 lines */ return }
// ✅ Explicit returns always

// ❌ Panic for control flow
if err != nil { panic(err) }
// ✅ Return errors; panic only for truly unrecoverable programmer errors

// ❌ Premature abstraction: repository + interface + mock before 2nd impl
// ✅ Wait until you have two concrete implementations

// ❌ Defer error ignoring
defer rows.Close()
// ✅ Handle or at minimum log
defer func() {
    if err := rows.Close(); err != nil {
        slog.Warn("Closing rows", "error", err)
    }
}()
```
