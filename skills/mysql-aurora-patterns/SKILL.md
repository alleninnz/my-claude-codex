---
name: mysql-aurora-patterns
description: Use when writing MySQL queries, designing Aurora schemas, optimizing indexes, or troubleshooting database performance.
origin: my-claude-code
---

# MySQL & Aurora Patterns

## Index Types

MySQL supports several index types. Choose based on query patterns.

**B-tree (default)** — used for equality, range, ORDER BY, and GROUP BY:

```sql
-- Single column
CREATE INDEX idx_user_email ON users (email);

-- Composite: leftmost prefix rule applies
-- Supports: (status), (status, created_at), (status, created_at, user_id)
-- Does NOT support: (created_at) alone or (user_id) alone
CREATE INDEX idx_orders_status_created ON orders (status, created_at, user_id);
```

**Covering index** — index contains all columns needed by the query, avoiding table lookup:

```sql
-- Query: SELECT id, email FROM users WHERE status = 'active'
-- This index covers the query entirely (no row lookup needed)
CREATE INDEX idx_users_status_covering ON users (status, id, email);
```

**Fulltext index** — for natural language and boolean text search:

```sql
CREATE FULLTEXT INDEX idx_posts_content ON posts (title, body);

-- Natural language search
SELECT * FROM posts WHERE MATCH(title, body) AGAINST ('aurora mysql' IN NATURAL LANGUAGE MODE);

-- Boolean mode with operators
SELECT * FROM posts WHERE MATCH(title, body) AGAINST ('+aurora -postgres' IN BOOLEAN MODE);
```

**Spatial index** — for geometry columns (requires MyISAM or InnoDB with NOT NULL):

```sql
CREATE TABLE locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  point POINT NOT NULL SRID 4326,
  SPATIAL INDEX idx_locations_point (point)
);
```

**Partial index via generated column** — MySQL lacks native partial indexes; use a generated column:

```sql
-- Index only active users' emails
ALTER TABLE users
  ADD COLUMN email_if_active VARCHAR(255) AS (IF(status = 'active', email, NULL)) VIRTUAL,
  ADD INDEX idx_active_email (email_if_active);
```

## Data Type Reference

| Need | MySQL Type | Notes |
|------|-----------|-------|
| Primary key / foreign key | `BIGINT UNSIGNED` | Avoid `INT` — hits 2B limit in large tables |
| Timestamps | `DATETIME(6)` | Stores microseconds; prefer over `TIMESTAMP` (limited range) |
| Money / exact decimal | `DECIMAL(19, 4)` | Never use `FLOAT`/`DOUBLE` for money |
| Short indexed strings | `VARCHAR(N)` with N sized to data | `VARCHAR(255)` everywhere is an anti-pattern |
| Long text | `TEXT` or `MEDIUMTEXT` | Not suitable for indexing directly |
| Boolean flags | `TINYINT(1)` | MySQL has no native BOOL; this is the convention |
| UUIDs | `CHAR(36)` or `BINARY(16)` | `BINARY(16)` is more efficient; use `UUID_TO_BIN()` |
| Semi-structured data | `JSON` | Index specific keys via generated columns (see below) |
| Enum-like values | `VARCHAR` + CHECK or application-level enum | Avoid `ENUM` type — altering it requires a table rebuild |

**JSON column with generated column index:**

```sql
CREATE TABLE events (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payload  JSON            NOT NULL,
  -- Virtual generated column for indexing a JSON key
  event_type VARCHAR(64) AS (JSON_UNQUOTE(payload->>'$.type')) VIRTUAL,
  INDEX idx_event_type (event_type)
);

-- Query uses the index
SELECT * FROM events WHERE event_type = 'order.created';
```

**DATETIME(6) for created_at / updated_at:**

```sql
CREATE TABLE orders (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);
```

## Aurora-Specific Features

Aurora MySQL is wire-compatible with MySQL 8.0 but has cluster-level features.

**Endpoints:**

| Endpoint | Usage |
|----------|-------|
| Cluster (writer) endpoint | All writes; always routes to the primary |
| Reader endpoint | Load-balances across read replicas; use for read-heavy queries |
| Instance endpoint | Connect to a specific instance (avoid in app code — not failover-safe) |

**Read replicas:**

```text
Writer:   aurora-cluster.cluster-xxxx.us-east-1.rds.amazonaws.com
Reader:   aurora-cluster.cluster-ro-xxxx.us-east-1.rds.amazonaws.com
```

Route read-only queries (reports, searches, analytics) to the reader endpoint to offload the primary.

**Replica read consistency** — by default, replicas are eventually consistent (~milliseconds lag). For session consistency after a write:

```sql
-- After writing, set on the read connection:
SET aurora_replica_read_consistency = 'SESSION';
```

Options: `EVENTUAL` (default), `SESSION`, `GLOBAL`.

**Failover** — Aurora promotes a replica to primary in ~30 seconds. Design for it:

- Use the cluster endpoint (not instance endpoints) in connection strings.
- Handle connection errors with retry logic (exponential backoff, 3–5 attempts).
- Keep transactions short so in-flight work can be safely retried.

**Aurora vs RDS MySQL — key differences:**

| Feature | Aurora MySQL | RDS MySQL |
|---------|-------------|-----------|
| Storage | Auto-scales to 128 TiB | Manual provisioning |
| Replicas | Up to 15, sub-10ms lag | Up to 5, higher lag |
| Failover | ~30s automated | ~60–120s |
| Backtrack | Point-in-time rewind (no restore) | Requires snapshot restore |

## Query Optimization

**EXPLAIN ANALYZE** (MySQL 8.0.18+) — shows actual execution stats, not just estimates:

```sql
EXPLAIN ANALYZE
SELECT u.id, u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.status = 'active'
GROUP BY u.id, u.email;
-- Look for: "rows examined", "actual rows", "Using filesort", "Using temporary"
```

**Avoiding filesort** — ensure ORDER BY columns are covered by an index in the same order:

```sql
-- Bad: filesort if no index on (status, created_at)
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC;

-- Good: composite index eliminates filesort
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
```

**Covering index scan** — select only indexed columns to skip row lookups:

```sql
-- Index: (status, created_at, id)
-- This query is served entirely from the index
SELECT id, created_at FROM orders WHERE status = 'shipped' ORDER BY created_at DESC LIMIT 20;
```

**Batch INSERT** — single multi-row INSERT is far faster than individual inserts:

```sql
-- Slow: 1000 round trips
INSERT INTO events (type, payload) VALUES ('click', '{}');
-- ... repeated 999 more times

-- Fast: one round trip
INSERT INTO events (type, payload) VALUES
  ('click', '{"page":"/"}'),
  ('click', '{"page":"/about"}'),
  ('view',  '{"page":"/pricing"}');
-- Aim for 100–1000 rows per batch depending on row size
```

**Upsert with `INSERT ... ON DUPLICATE KEY UPDATE`:**

```sql
INSERT INTO user_stats (user_id, login_count, last_login)
VALUES (42, 1, NOW())
ON DUPLICATE KEY UPDATE
  login_count = login_count + 1,
  last_login  = VALUES(last_login);
```

## Pagination

**OFFSET pagination — avoid on large tables:**

```sql
-- Slow: scans and discards 100,000 rows
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 100000;
```

Why it's expensive: MySQL must read and discard all preceding rows even though they're not returned.

**Cursor-based pagination — use this instead:**

```sql
-- First page
SELECT id, created_at, total FROM orders
WHERE status = 'completed'
ORDER BY id ASC
LIMIT 20;

-- Next page: pass the last `id` from the previous result as the cursor
SELECT id, created_at, total FROM orders
WHERE status = 'completed'
  AND id > :last_cursor_id
ORDER BY id ASC
LIMIT 20;
```

Cursor-based pagination is O(1) regardless of page depth because the `id > ?` predicate uses the primary key index directly.

For multi-column sort keys (e.g., `created_at, id`):

```sql
-- Cursor encodes both columns
SELECT id, created_at FROM orders
WHERE (created_at, id) > (:last_created_at, :last_id)
ORDER BY created_at ASC, id ASC
LIMIT 20;
```

## Anti-Patterns

**Unindexed foreign keys** — MySQL does NOT auto-index FKs (unlike PostgreSQL). Every unindexed FK causes full table scans on JOIN and cascading deletes/updates:

```sql
-- Bad
CREATE TABLE order_items (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
  -- Missing: INDEX on order_id
);

-- Good
CREATE TABLE order_items (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  INDEX idx_order_items_order_id (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

**`SELECT *`** — fetches unneeded columns, prevents covering index use, breaks when columns are added:

```sql
-- Bad
SELECT * FROM users WHERE id = 42;

-- Good
SELECT id, email, status, created_at FROM users WHERE id = 42;
```

**OFFSET on large tables** — see Pagination section. Replace with cursor-based pagination.

**`VARCHAR(255)` as default** — wastes index space and memory for short values. Size columns to their actual data:

```sql
-- Bad: country codes don't need 255 chars
country_code VARCHAR(255)

-- Good
country_code CHAR(2) NOT NULL
```

**Missing `NOT NULL`** — nullable columns complicate queries, disable certain optimizations, and hide bugs:

```sql
-- Bad: NULL propagates through expressions in unexpected ways
amount DECIMAL(19,4)

-- Good
amount DECIMAL(19,4) NOT NULL DEFAULT 0
```

**Implicit type coercion** — comparing columns of mismatched types disables index use:

```sql
-- Bad: user_id is BIGINT, but compared to a string — index skipped
SELECT * FROM orders WHERE user_id = '42';

-- Good: types match
SELECT * FROM orders WHERE user_id = 42;
```

**Functions on indexed columns in WHERE** — wrapping a column in a function prevents index use:

```sql
-- Bad: index on created_at is not used
SELECT * FROM orders WHERE YEAR(created_at) = 2024;

-- Good: range scan uses the index
SELECT * FROM orders WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';
```

## Connection Management

**Pooling** — always use a connection pool; never open a new connection per query.

Recommended pool settings (adjust based on workload):

| Parameter | Recommended | Notes |
|-----------|------------|-------|
| `min_idle` | 2–5 | Keep warm connections ready |
| `max_pool_size` | 10–20 per app instance | Stay well below `max_connections` |
| `connection_timeout` | 3–5s | Fail fast rather than queue |
| `idle_timeout` | 600s | Recycle idle connections |
| `max_lifetime` | 1800s | Prevent stale connections past Aurora failover |

**`max_connections`** — Aurora's default scales with instance class (e.g., `db.r6g.large` ≈ 1000). Rule of thumb: `max_pool_size × app_instances < max_connections × 0.8`. Use RDS Proxy to multiplex connections if you have many app instances.

**Timeouts** — set at both the application and database level:

```sql
-- Session-level query timeout (MySQL 8.0+)
SET SESSION MAX_EXECUTION_TIME = 5000;  -- 5 seconds, in milliseconds

-- Or per-query hint
SELECT /*+ MAX_EXECUTION_TIME(5000) */ * FROM large_table WHERE ...;
```

**Reconnect on failover** — after an Aurora failover the writer endpoint DNS updates (~30s). Configure your pool with:

- `max_lifetime` shorter than 30 minutes to avoid keeping connections to a demoted instance.
- Retry logic: catch connection errors and retry with exponential backoff (100ms, 200ms, 400ms, up to 3–5 attempts).
