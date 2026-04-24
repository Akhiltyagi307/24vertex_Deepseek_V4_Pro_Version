---
title: Partition Large Tables for Better Performance
impact: MEDIUM-HIGH
impactDescription: 5-20x faster queries and maintenance on large tables
tags: partitioning, large-tables, time-series, performance
designReference: ../../ui-craft/references/design-v2.md
---

## Partition Large Tables for Better Performance

Partitioning splits a large table into smaller pieces, improving query performance and maintenance operations.

**Incorrect (single large table):**

```sql
create table events (
  id bigint generated always as identity,
  created_at timestamptz,
  data jsonb
);

-- 500M rows, queries scan everything
select * from events where created_at > '2024-01-01';  -- Slow
vacuum events;  -- Takes hours, locks table
```

**Correct (partitioned by time range):**

```sql
create table events (
  id bigint generated always as identity,
  created_at timestamptz not null,
  data jsonb
) partition by range (created_at);

-- Create partitions for each month
create table events_2024_01 partition of events
  for values from ('2024-01-01') to ('2024-02-01');

create table events_2024_02 partition of events
  for values from ('2024-02-01') to ('2024-03-01');

-- Queries only scan relevant partitions
select * from events where created_at > '2024-01-15';  -- Only scans events_2024_01+

-- Drop old data instantly
drop table events_2023_01;  -- Instant vs DELETE taking hours
```

When to partition:

- Tables > 100M rows
- Time-series data with date-based queries
- Need to efficiently drop old data


---

## UI & presentation (Supabase Design System v2)

When this Postgres/Supabase work surfaces in product UI—Studio-style tables, SQL editor, metrics, or dashboards—use **[design-v2.md](../../ui-craft/references/design-v2.md)** as the canonical design reference: CSS variables and tokens; typography (JetBrains Mono for UUIDs, numerics, SQL); data tables (NULL and UUID styling per §3.3 and §8.7); SQL syntax palette (§10); charts, toasts, modals; dark-first layout; motion and icons (§16–§17). Accessibility: §7 (focus rings, contrast). Prefer CSS variables (`--brand`, `--foreground-*`) over raw hex in components.

Reference: [Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
