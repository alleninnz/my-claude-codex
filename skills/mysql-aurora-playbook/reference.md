# MySQL 8.0 & Aurora MySQL 3 Reference

Aurora MySQL 3.x maps to community MySQL 8.0 (e.g., 3.04.x = 8.0.28 LTS, 3.08.x = 8.0.39).

## Index Types

**B-tree (default)** — equality, range, ORDER BY, GROUP BY:

```sql
-- Composite: leftmost prefix rule applies
-- Supports: (status), (status, created_at), (status, created_at, user_id)
-- Does NOT support: (created_at) alone or (user_id) alone
CREATE INDEX idx_orders_status_created ON orders (status, created_at, user_id);
```

**Covering index** — all columns needed by query are in the index, skipping row lookup:

```sql
-- Query: SELECT id, email FROM users WHERE status = 'active'
-- InnoDB secondary indexes implicitly include PK (id), no need to add it
CREATE INDEX idx_users_covering ON users (status, email);
```

**Descending index (8.0+)** — true DESC storage, eliminates backward scan for mixed-direction sorts:

```sql
-- Useful for: ORDER BY created_at DESC, id ASC
CREATE INDEX idx_mixed ON orders (created_at DESC, id ASC);
-- Single-column DESC indexes yield marginal gains — backward scan is adequate
```

**Functional index (8.0.13+)** — index on expressions, double parentheses required:

```sql
CREATE INDEX idx_lower_email ON users ((LOWER(email)));
-- Query must match exactly: WHERE LOWER(email) = ? hits the index
-- WHERE UPPER(email) = ? does NOT
-- Cannot be PK; does not support ICP
```

**Invisible index (8.0+)** — soft-delete index without dropping; optimizer ignores but still maintained:

```sql
ALTER TABLE orders ALTER INDEX idx_old_status INVISIBLE;
-- Test impact, then drop if safe:
ALTER TABLE orders DROP INDEX idx_old_status;
-- Gotcha: FORCE INDEX on invisible index silently does a full table scan
-- Still enforces UNIQUE constraints while invisible
```

**Multi-valued index (8.0.17+)** — index into JSON arrays:

```sql
CREATE TABLE products (
  id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  doc   JSON NOT NULL,
  INDEX idx_tags ((CAST(doc->'$.tags' AS CHAR(64) ARRAY)))
);
-- Works with: MEMBER OF(), JSON_CONTAINS(), JSON_OVERLAPS()
-- Limitations: one multi-valued key per index, no range scans, no covering,
-- ALGORITHM=COPY required, does NOT work in JOIN conditions (bug #110015)
```

**Fulltext index** — natural language and boolean text search:

```sql
CREATE FULLTEXT INDEX idx_posts_content ON posts (title, body);
SELECT * FROM posts WHERE MATCH(title, body) AGAINST ('+aurora -postgres' IN BOOLEAN MODE);
```

**Partial index via generated column** — MySQL lacks native partial indexes:

```sql
ALTER TABLE users
  ADD COLUMN email_if_active VARCHAR(255) AS (IF(status = 'active', email, NULL)) VIRTUAL,
  ADD INDEX idx_active_email (email_if_active);
-- VIRTUAL: computed on read, no storage, no ICP support
-- STORED: written to disk, supports any index type including PK, full ICP
```

**Prefer optimizer hints over legacy index hints:**

```sql
-- New (8.0.20+): warns on missing index, finer control
SELECT /*+ INDEX(o idx_status) */ * FROM orders o WHERE ...;
SELECT /*+ NO_INDEX(o idx_old) */ * FROM orders o WHERE ...;

-- Legacy (avoid): silently scans if index missing
SELECT * FROM orders FORCE INDEX (idx_status) WHERE ...;
```

**Aurora-specific index behaviors:**

- Asynchronous Key Prefetch (AKP): optimizes secondary→primary lookups via BKA/MRR
- Fast B-tree Inserts (3.03.2+): caches cursor positions, only works with AHI disabled
- AHI works on writer only — cannot be enabled on read replicas (shared storage)
- Parallel Query bypasses indexes entirely — activates only for data-intensive full scans

## Data Type Reference

| Need | Type | Notes |
|------|------|-------|
| PK / FK | `BIGINT UNSIGNED` | Avoid `INT` — 2B limit |
| Timestamps | `DATETIME(6)` | Microseconds; TIMESTAMP has 2038 limit |
| Money | `DECIMAL(19, 4)` | Never `FLOAT`/`DOUBLE` for money |
| Short indexed strings | `VARCHAR(N)` sized to data | `VARCHAR(255)` everywhere is anti-pattern |
| Long text | `TEXT` / `MEDIUMTEXT` | Not directly indexable |
| Boolean | `TINYINT(1)` | MySQL convention, no native BOOL |
| UUIDs | `BINARY(16)` | See UUID section below |
| Semi-structured | `JSON` | Index via generated columns or multi-valued index |
| Enum-like | `VARCHAR` + CHECK | Avoid `ENUM` type (DDL rebuild to insert mid-list) |
| Hashes / tokens | `BINARY(N)` or `VARBINARY(N)` | More efficient than hex-encoded CHAR |
| Country codes | `CHAR(2) NOT NULL` | Size to actual data |

**UUID storage — high-impact decision:**

```sql
-- BAD: CHAR(36) with utf8mb4 = up to 144 bytes per key
uuid CHAR(36)

-- GOOD: BINARY(16) = 16 bytes per key (9x smaller, propagates to all secondary indexes)
uuid BINARY(16)

-- UUIDv1: use swap flag to reorder time components for sequential inserts
INSERT INTO t (uuid) VALUES (UUID_TO_BIN(UUID(), 1));
SELECT BIN_TO_UUID(uuid, 1) FROM t;

-- UUIDv7 (RFC 9562): inherently time-ordered, 2-3x faster inserts than v4
-- Generate in application code, no swap needed
INSERT INTO t (uuid) VALUES (UUID_TO_BIN(@app_generated_uuidv7, 0));
```

**DATETIME vs TIMESTAMP decision guide:**

```sql
-- DATETIME:    5 bytes base (+3 for fractional = 8 bytes at precision 6)
-- TIMESTAMP:   4 bytes base (+3 for fractional = 7 bytes at precision 6)
-- DATETIME range: 1000-01-01 to 9999-12-31, no TZ conversion
-- TIMESTAMP range: 1970-01-01 to 2038-01-19, auto UTC conversion
-- Recommendation: DATETIME for new systems (2038 limit approaching)
-- TIMESTAMP still valid for created_at/updated_at if dates won't exceed 2038
-- Always: SET explicit_defaults_for_timestamp = ON in 8.0

CREATE TABLE orders (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);
```

**JSON column with generated column index:**

```sql
CREATE TABLE events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payload    JSON            NOT NULL,
  event_type VARCHAR(64) AS (JSON_UNQUOTE(payload->>'$.type')) VIRTUAL,
  INDEX idx_event_type (event_type)
);
SELECT * FROM events WHERE event_type = 'order.created';
```

**Charset / collation:**

- Default in 8.0: `utf8mb4` with `utf8mb4_0900_ai_ci` (34% faster than `utf8mb4_general_ci`)
- `utf8mb4_0900_ai_ci` uses NO PAD: `'abc' ≠ 'abc  '` — may break UNIQUE constraints on migration
- Mixing `utf8mb3`/`utf8mb4` in JOINs silently prevents index usage → full table scan
- For ASCII-only columns (hashes, tokens): `CHARACTER SET ascii` per-column to halve index size

## Aurora-Specific Features

**Endpoints:**

| Endpoint | Usage |
|----------|-------|
| Cluster (writer) | All writes; always routes to primary |
| Reader | Load-balances across read replicas; use for read-heavy queries |
| Instance | Specific instance (avoid in app code — not failover-safe) |

```text
Writer: aurora-cluster.cluster-xxxx.us-east-1.rds.amazonaws.com
Reader: aurora-cluster.cluster-ro-xxxx.us-east-1.rds.amazonaws.com
```

**Serverless v2:**

- Scales 0–256 ACUs (each ACU ≈ 2 GiB memory), 0.5 ACU increments
- Scale-to-zero (min ACU = 0): requires Aurora MySQL 3.08.0+, ~15s resume, 30s+ if paused >24h
- `max_connections` derived from **max ACU** and stays constant during scaling
- Performance Insights requires min 2 ACU; Global Database requires min 8 ACU
- Set min ACU close to typical baseline — higher minimum enables faster scale-up

**I/O-Optimized (`aurora-iopt1`):**

- Eliminates per-I/O charges, ~30% higher compute costs
- Break-even: I/O costs ≈ 25% of total Aurora spend
- Switch once per 30 days, no downtime
- Model with actual `VolumeReadIOPs`/`VolumeWriteIOPs` before switching

**Parallel Query:**

```sql
SET aurora_parallel_query = 1;
-- Pushes filtering/projection/aggregation to storage layer
-- Bypasses buffer pool entirely; activates only for data-intensive full scans
-- Aurora MySQL 3: supports TEXT, BLOB, JSON, GEOMETRY, partitioned tables
-- Verify: EXPLAIN shows "Using parallel query"
```

**Read consistency — performance costs:**

```sql
-- SESSION and GLOBAL wait for redo log apply to specific LSN — adds latency
-- EVENTUAL: fastest, default, stale reads possible (~ms lag)
-- SESSION: read-your-own-writes within session, higher latency
-- GLOBAL: all reads globally consistent, highest latency
SET aurora_replica_read_consistency = 'SESSION';
-- WARNING: Do not set globally — use per-session after writes
-- NOTE: RDS Proxy does not support SESSION consistency
```

**Backtrack:**

- Rewinds cluster to point within last 72 hours, in seconds
- Cluster-wide only; incompatible with cross-region replicas, binlog replication, Blue/Green
- Actual window may be smaller than configured under heavy writes
- Use for quick undo; use point-in-time recovery for everything else

**Blue/Green Deployments:**

- Requires `binlog_format = ROW` or `MIXED` (reboot needed to enable)
- Green environment replication is single-threaded — high write throughput causes lag
- Backtrack configuration not carried to green environment

**Failover:**

- Aurora promotes replica in ~30 seconds via DNS
- AWS Advanced JDBC Wrapper (`aws-advanced-jdbc-wrapper`): ~6s failover via topology cache
- Provides: failover, enhanced failure monitoring, read-write splitting, IAM auth
- **Recommended driver for all Aurora MySQL deployments**
- Keep transactions short for safe retry on failover

**Authentication & Security:**

- `caching_sha2_password` is 8.0 default — older clients/drivers may need `mysql_native_password` fallback
- IAM database authentication: token-based, no password in app config, 256 max connections per second per IAM auth
- SSL/TLS enforced per-user: `ALTER USER 'app'@'%' REQUIRE SSL;`
- MySQL 8.0 roles: `CREATE ROLE 'read_only'; GRANT SELECT ON db.* TO 'read_only'; GRANT 'read_only' TO 'app_user';`
- Aurora: use AWS JDBC Wrapper's IAM auth plugin for seamless token rotation

**Aurora vs RDS MySQL:**

| Feature | Aurora MySQL | RDS MySQL |
|---------|-------------|-----------|
| Storage | Auto-scales to 128 TiB | Manual provisioning |
| Replicas | Up to 15, sub-10ms lag | Up to 5, higher lag |
| Failover | ~30s (6s with JDBC wrapper) | ~60–120s |
| Backtrack | Point-in-time rewind | Requires snapshot restore |

## Query Optimization

**EXPLAIN ANALYZE (8.0.18+)** — actually executes query, shows real timing:

```sql
EXPLAIN ANALYZE
SELECT u.id, u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.status = 'active'
GROUP BY u.id, u.email;

-- Read the output:
-- actual time=X..Y: X = time to first row, Y = time to all rows (ms per loop)
-- rows=N: actual rows processed
-- When estimated rows ≫ actual rows: stale stats or missing histograms
-- NEVER use on production for expensive queries — it runs the query
```

**EXPLAIN FORMAT=TREE / FORMAT=JSON** — richer than default tabular:

```sql
EXPLAIN FORMAT=TREE SELECT ...;  -- hierarchical iterator view
EXPLAIN FORMAT=JSON SELECT ...;  -- detailed cost breakdown
```

**Optimizer hints — commonly used:**

```sql
-- Per-query variable change
SELECT /*+ SET_VAR(join_buffer_size=16777216) */ ...;

-- Index control (8.0.20+)
SELECT /*+ INDEX(t1 idx1) NO_INDEX(t1 idx_old) */ ...;

-- Join strategy
SELECT /*+ HASH_JOIN(t1) */ ... FROM t1 JOIN t2 ...;
SELECT /*+ NO_BNL(t1) */ ...;  -- disables hash join in 8.0.20+ (BNL was replaced; NO_HASH_JOIN removed)

-- CTE materialization control
WITH /*+ NO_MERGE(cte) */ cte AS (...) SELECT ...;

-- Semijoin strategy
SELECT /*+ SEMIJOIN(@subq FIRSTMATCH) QB_NAME(subq) */ ...;

-- Query timeout (SELECT only!)
SELECT /*+ MAX_EXECUTION_TIME(5000) */ * FROM large_table WHERE ...;
```

**CTE optimization (8.0+):**

- CTE referenced multiple times: materialized once and reused (unlike views)
- Control: `/*+ MERGE(cte) */` or `/*+ NO_MERGE(cte) */`
- Recursive CTEs always materialized; limit via `cte_max_recursion_depth` (default 1000)

**Hash joins (8.0.18+):**

- Replaces Block Nested Loop (from 8.0.20)
- Auto-activates for equi-joins without usable indexes
- Works for semi-joins, anti-joins (8.0.20+), outer joins
- Memory: `join_buffer_size`

**Histograms:**

```sql
-- Help optimizer with skewed distributions on non-indexed columns
ANALYZE TABLE orders UPDATE HISTOGRAM ON status WITH 64 BUCKETS;
-- Not auto-updated — re-run periodically after significant data changes
```

**Avoiding filesort:**

```sql
-- Ensure ORDER BY columns covered by index in same order
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
SELECT id, created_at FROM orders WHERE status = 'shipped' ORDER BY created_at DESC LIMIT 20;
```

**Batch INSERT:**

```sql
-- 10-20x faster than individual INSERTs
INSERT INTO events (type, payload) VALUES
  ('click', '{"page":"/"}'),
  ('click', '{"page":"/about"}'),
  ('view',  '{"page":"/pricing"}');
-- Aim for 500-1000 rows per batch
-- LOAD DATA LOCAL INFILE is ~20x faster still
```

**Upsert (8.0.19+ row alias syntax):**

```sql
-- VALUES() in ON DUPLICATE KEY UPDATE is deprecated since 8.0.20 — use row alias
INSERT INTO user_stats (user_id, login_count, last_login)
VALUES (42, 1, NOW()) AS new
ON DUPLICATE KEY UPDATE
  login_count = login_count + 1,
  last_login  = new.last_login;
```

## Pagination

**OFFSET — avoid on large tables:**

```sql
-- Slow: scans and discards 100,000 rows, ~100x slower at deep offsets
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 100000;
```

**Cursor-based pagination (recommended):**

```sql
-- First page
SELECT id, created_at, total FROM orders
WHERE status = 'completed'
ORDER BY id ASC LIMIT 20;

-- Next page: pass last id as cursor
SELECT id, created_at, total FROM orders
WHERE status = 'completed' AND id > :last_id
ORDER BY id ASC LIMIT 20;
```

**Multi-column cursor — use decomposed OR, NOT row constructor:**

```sql
-- BAD: row constructor inequality — optimizer cannot use full composite index
-- Benchmarked: 16s on 2M rows vs <1s for decomposed version
SELECT * FROM orders
WHERE (created_at, id) > (:last_created_at, :last_id)
ORDER BY created_at ASC, id ASC LIMIT 20;

-- GOOD: decomposed OR — uses composite index efficiently
SELECT * FROM orders
WHERE created_at > :last_created_at
   OR (created_at = :last_created_at AND id > :last_id)
ORDER BY created_at ASC, id ASC LIMIT 20;

-- Requires composite index:
CREATE INDEX idx_orders_created_id ON orders (created_at, id);
```

**Deferred join — retains addressable pages, 80% faster at deep offsets:**

```sql
SELECT o.* FROM orders o
INNER JOIN (
  SELECT id FROM orders ORDER BY created_at LIMIT 100000, 20
) sub USING(id);
-- Inner query reads only PK via covering index, outer fetches full rows for 20 matches
```

**Cursor API tips:**

- Fetch N+1 rows to determine `hasNextPage` without COUNT
- Encode cursor as opaque Base64 token (sort columns + unique tiebreaker)
- Always include unique column (id) in ORDER BY as tiebreaker

## Anti-Patterns

**Unindexed foreign keys** — MySQL does NOT auto-index FKs:

```sql
-- BAD: full table scan on JOIN and cascading deletes
CREATE TABLE order_items (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- GOOD: explicit index
CREATE TABLE order_items (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  INDEX idx_order_items_order_id (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

**`SELECT *`** — prevents covering index, breaks on column changes:

```sql
SELECT id, email, status FROM users WHERE id = 42;  -- not SELECT *
```

**Implicit type coercion** — disables index use:

```sql
-- BAD: user_id is BIGINT but compared to string
WHERE user_id = '42'
-- GOOD: types match
WHERE user_id = 42
```

**Functions on indexed columns in WHERE:**

```sql
-- BAD: index on created_at unused
WHERE YEAR(created_at) = 2024
-- GOOD: range scan uses index
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
```

**Missing `NOT NULL`** — nullable columns complicate queries, disable optimizations:

```sql
amount DECIMAL(19,4) NOT NULL DEFAULT 0  -- not just DECIMAL(19,4)
```

**Long transactions / idle connections:**

- Under REPEATABLE READ, open transactions block undo purge → HLL growth
- On Aurora: **replica long-running queries block purge on shared storage**, degrading writer
- Normal HLL: <1,000; alert at 100,000+
- Monitor: `RollbackSegmentHistoryListLength` CloudWatch metric
- Fix: switch analytics to READ COMMITTED, use S3 exports over mysqldump on replicas

**`MAX_EXECUTION_TIME` only works for SELECT:**

- Does nothing for INSERT, UPDATE, DELETE, or DDL
- For DML timeout: use `innodb_lock_wait_timeout` (default 50s) or app-level timeouts

**Implicit charset conversion:**

- `utf8mb3` JOIN `utf8mb4` → silent full table scan (index bypassed)
- Collation mismatch → "Illegal mix of collations" error
- Audit all schemas for consistency, especially after 5.7→8.0 upgrade

**OR across different indexed columns:**

```sql
-- May trigger catastrophically slow index_merge
-- Prefer: composite index, or UNION ALL for explicit plan control
SELECT /*+ NO_INDEX_MERGE(t1) */ * FROM t1 WHERE col1 = ? OR col2 = ?;
```

**Deadlock detection overhead:**

- Default `innodb_deadlock_detect = ON` uses O(n²) algorithm
- High concurrency: consider disabling + lowering `innodb_lock_wait_timeout` to 3-10s
- Enable `innodb_print_all_deadlocks` to log all deadlocks

## DDL & Schema Migration

**Instant DDL (`ALGORITHM=INSTANT`)** — metadata-only, no table rebuild:

```sql
-- Supported (8.0.29+): add/drop columns at any position, rename columns,
-- set/drop defaults, append ENUM values
ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) DEFAULT NULL, ALGORITHM=INSTANT;

-- NOT supported: add/drop indexes, change data types, add FKs, convert charset
-- After 64 instant ADD/DROP operations: instant DDL fails (ERROR 4092)
-- Reset: OPTIMIZE TABLE users;
-- Always specify ALGORITHM=INSTANT explicitly — without it, MySQL silently falls back
```

**Aurora Fast DDL: deprecated and removed in Aurora MySQL 3.** Use community instant DDL.

**Online DDL for index operations:**

```sql
-- Adding index: INPLACE, no rebuild, concurrent DML allowed
ALTER TABLE orders ADD INDEX idx_new (col1, col2), ALGORITHM=INPLACE, LOCK=NONE;
```

**MDL contention — the silent DDL killer:**

```sql
-- All DDL needs exclusive MDL; if any open tx holds shared MDL, DDL queues
-- All subsequent queries on that table queue behind DDL
-- Default lock_wait_timeout = 31,536,000s (1 YEAR!) — catastrophic
-- ALWAYS before DDL:
SET SESSION lock_wait_timeout = 10;
-- Check for blockers first:
SELECT * FROM information_schema.innodb_trx ORDER BY trx_started;
```

**gh-ost vs pt-online-schema-change on Aurora:**

- gh-ost (binlog-based, triggerless): use `--allow-on-master --assume-rbr`; no FK support
- pt-osc (trigger-based): works natively, adds write amplification on shared storage
- Use gh-ost for tables without FKs; pt-osc for tables with FKs

## Batch Operations

**Bulk insert best practices:**

```sql
-- Multi-row INSERT: 500-1000 rows per batch
-- Disable autocommit, commit every 1,000-10,000 rows
-- Insert in PK order for clustered index optimization
-- Aurora + binlog: keep < 1M inserts per transaction
SET autocommit = 0;
INSERT INTO events (type, payload) VALUES (...), (...), ...;  -- 1000 rows
COMMIT;
```

**`innodb_autoinc_lock_mode` (8.0 default = 2 "interleaved"):**

- Eliminates all table-level AUTO-INC locks
- Safe because 8.0 defaults to row-based replication
- Maximum concurrency, possible ID gaps (harmless)

**Batch DELETE/UPDATE — chunk by PK range:**

```sql
-- Avoid: DELETE ... LIMIT N (repeated sorting)
-- Good: PK range chunking with throttling
SET @batch = 1000;
SET @start = 0;
REPEAT
  DELETE FROM old_events
  WHERE id BETWEEN @start AND @start + @batch - 1
    AND created_at < '2024-01-01';
  SET @start = @start + @batch;
  COMMIT;
  DO SLEEP(0.5);  -- throttle to avoid HLL spike
UNTIL ROW_COUNT() = 0 END REPEAT;

-- Best: partitioned tables with DROP PARTITION for instant range removal
-- Tool: pt-archiver for automated nibble-based deletes with throttling
```

**Aurora batch operation concerns:**

- Long read views on replicas block purge on shared storage → writer degradation
- Monitor `RollbackSegmentHistoryListLength` — throttle if HLL > 100K
- Run during off-peak, batch size 1,000-5,000 with sleep between batches

## Connection Management

**Pool settings (per app instance):**

| Parameter | Recommended | Notes |
|-----------|------------|-------|
| `min_idle` | 2–5 | Keep warm connections |
| `max_pool_size` | 10–20 | Total across instances < 80% of `max_connections` |
| `connection_timeout` | 10s | Fail fast |
| `idle_timeout` | 600s | Recycle idle connections |
| `max_lifetime` | 1800s | Prevent stale connections past failover |
| `keepalive_time` | 180s | Detect broken connections |

**`max_connections` formula on Aurora:**

```sql
GREATEST(log2(DBInstanceClassMemory/805306368)*45, log2(DBInstanceClassMemory/8187281408)*1000)
-- ~45 on db.t3.medium, ~5000 on db.r6g.8xlarge
-- Serverless v2: derived from max ACU, reboot required after changing max ACU
```

**RDS Proxy — when to use and avoid:**

Use for: Lambda connection storms, many short-lived app instances, failover transparency.

Avoid when:

- Heavy connection pinning (SET statements, prepared statements, temp tables, user variables)
- Serverless v2 scale-to-zero (proxy keeps connections open)
- Ultra-low-latency workloads (adds ~1-5ms per hop)
- Need SESSION replica read consistency (not supported)

**Timeouts:**

```sql
-- DML timeout (MAX_EXECUTION_TIME is SELECT-only — see Anti-Patterns)
SET SESSION innodb_lock_wait_timeout = 10;

-- No native transaction_timeout in MySQL (unlike MariaDB/PostgreSQL)
-- Use application-level timeout or pt-kill
```

**Reconnect on failover:**

- Cluster endpoint DNS TTL = 5 seconds
- AWS JDBC Wrapper: ~6s failover (recommended)
- Without wrapper: retry with exponential backoff (100ms, 200ms, 400ms, up to 5 attempts)
- HikariCP on Aurora: mass connection recycling at maxLifetime can pin all connections to one replica — use JDBC wrapper's `initialConnection` plugin for round-robin

## Monitoring

**Critical CloudWatch metrics — alert thresholds:**

| Metric | Alert | Notes |
|--------|-------|-------|
| `CPUUtilization` | >70-80% sustained | Scale up or optimize queries |
| `BufferCacheHitRatio` | <95% | Should be >99%; indicates undersized instance |
| `AuroraReplicaLag` | >100ms | For low-latency workloads |
| `DatabaseConnections` | >80% of max | Connection leak or undersized pool |
| `Deadlocks` | Sustained non-zero | Review lock patterns |
| `RollbackSegmentHistoryListLength` | >100K | Long transactions blocking purge |
| `VolumeReadIOPs` / `VolumeWriteIOPs` | — | Evaluate I/O-Optimized savings |

**Performance Insights:**

- DBLoad metric: average active sessions; when > vCPU count → CPU-constrained
- Key Aurora wait events:
  - `io/aurora_redo_log_flush` — commit-heavy, redo log waits
  - `synch/mutex/innodb/buf_pool_mutex` — buffer pool contention
  - `synch/rwlock/innodb/index_tree_rw_lock` — B-tree contention
- Standard: 7 days free; Advanced: 2 years + execution plan analysis

**InnoDB internals (8.0):**

```sql
-- Lock monitoring (replaces 5.7 information_schema.innodb_lock_waits)
SELECT * FROM performance_schema.data_lock_waits;
SELECT * FROM performance_schema.data_locks;

-- Unused indexes (candidates for INVISIBLE testing)
SELECT * FROM sys.schema_unused_indexes;

-- History list length
SHOW ENGINE INNODB STATUS;  -- look for "History list length"
```

**Slow query log config:**

```sql
-- Aurora parameter group settings:
-- slow_query_log = 1
-- long_query_time = 1
-- log_slow_admin_statements = 1
-- log_slow_extra = 1                    (8.0.14+: adds Handler_* counters)
-- log_queries_not_using_indexes = 1
-- log_throttle_queries_not_using_indexes = 60
-- Publish to CloudWatch Logs for centralized analysis
```
