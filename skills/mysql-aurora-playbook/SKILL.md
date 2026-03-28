---
name: mysql-aurora-playbook
description: Use when writing MySQL queries, designing Aurora schemas, optimizing indexes, troubleshooting slow queries, fixing deadlocks, planning schema migrations, or tuning Aurora connection pools and failover.
---

# MySQL 8.0 & Aurora MySQL 3 Playbook

Aurora MySQL 3.x = community MySQL 8.0 (e.g., 3.04.x = 8.0.28 LTS, 3.08.x = 8.0.39).

## When to Use

- Writing or reviewing SQL queries (SELECT, INSERT, UPDATE, DELETE)
- Designing tables, indexes, or choosing data types
- Diagnosing slow queries, deadlocks, or HLL growth
- Planning DDL / schema migrations (instant DDL, gh-ost, pt-osc)
- Configuring Aurora endpoints, serverless v2, connection pools
- Setting up monitoring, alerts, or slow query logging

**Not for:** PostgreSQL, MariaDB-specific features, DynamoDB, or application-layer ORM patterns.

## Quick Reference

| Task | Pattern | Section |
|------|---------|---------|
| PK type | `BIGINT UNSIGNED` | Data Types |
| UUID storage | `BINARY(16)` + `UUID_TO_BIN()` | Data Types |
| Timestamps | `DATETIME(6)` over TIMESTAMP | Data Types |
| Upsert | `AS new` row alias (8.0.19+) | Query Optimization |
| Pagination | Cursor-based, not OFFSET | Pagination |
| Schema change | `ALGORITHM=INSTANT` first | DDL |
| Large table DDL | gh-ost (no FKs) / pt-osc (FKs) | DDL |
| Before any DDL | `SET SESSION lock_wait_timeout = 10` | DDL |
| Connection driver | AWS Advanced JDBC Wrapper | Connection Mgmt |
| Key alert metric | HLL < 100K | Monitoring |

## Full Reference

See @reference.md for detailed patterns, code examples, and Aurora-specific guidance covering:

- **Index Types** — B-tree, covering, descending, functional, invisible, multi-valued, fulltext, partial
- **Data Type Reference** — type selection table, UUID storage, DATETIME vs TIMESTAMP, JSON indexing, charset/collation
- **Aurora-Specific Features** — endpoints, serverless v2, I/O-optimized, parallel query, read consistency, backtrack, blue/green, failover, auth/security
- **Query Optimization** — EXPLAIN ANALYZE, optimizer hints, CTEs, hash joins, histograms, batch INSERT, upsert
- **Pagination** — cursor-based, multi-column cursor (decomposed OR), deferred join
- **Anti-Patterns** — unindexed FKs, SELECT *, type coercion, functions on indexed columns, long transactions, charset mixing, deadlock detection
- **DDL & Schema Migration** — instant DDL, online DDL, MDL contention, gh-ost vs pt-osc
- **Batch Operations** — bulk insert, PK-range chunking, Aurora HLL concerns
- **Connection Management** — pool settings, max_connections formula, RDS Proxy, timeouts, failover reconnect
- **Monitoring** — CloudWatch metrics, Performance Insights, InnoDB internals, slow query log
