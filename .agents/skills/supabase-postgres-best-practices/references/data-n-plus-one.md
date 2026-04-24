---
title: Eliminate N+1 Queries with Batch Loading
impact: MEDIUM-HIGH
impactDescription: 10-100x fewer database round trips
tags: n-plus-one, batch, performance, queries
designReference: ../../ui-craft/references/design-v2.md
---

## Eliminate N+1 Queries with Batch Loading

N+1 queries execute one query per item in a loop. Batch them into a single query using arrays or JOINs.

**Incorrect (N+1 queries):**

```sql
-- First query: get all users
select id from users where active = true;  -- Returns 100 IDs

-- Then N queries, one per user
select * from orders where user_id = 1;
select * from orders where user_id = 2;
select * from orders where user_id = 3;
-- ... 97 more queries!

-- Total: 101 round trips to database
```

**Correct (single batch query):**

```sql
-- Collect IDs and query once with ANY
select * from orders where user_id = any(array[1, 2, 3, ...]);

-- Or use JOIN instead of loop
select u.id, u.name, o.*
from users u
left join orders o on o.user_id = u.id
where u.active = true;

-- Total: 1 round trip
```

Application pattern:

```sql
-- Instead of looping in application code:
-- for user in users: db.query("SELECT * FROM orders WHERE user_id = $1", user.id)

-- Pass array parameter:
select * from orders where user_id = any($1::bigint[]);
-- Application passes: [1, 2, 3, 4, 5, ...]
```


---

## UI & presentation (Supabase Design System v2)

When this Postgres/Supabase work surfaces in product UI—Studio-style tables, SQL editor, metrics, or dashboards—use **[design-v2.md](../../ui-craft/references/design-v2.md)** as the canonical design reference: CSS variables and tokens; typography (JetBrains Mono for UUIDs, numerics, SQL); data tables (NULL and UUID styling per §3.3 and §8.7); SQL syntax palette (§10); charts, toasts, modals; dark-first layout; motion and icons (§16–§17). Accessibility: §7 (focus rings, contrast). Prefer CSS variables (`--brand`, `--foreground-*`) over raw hex in components.

Reference: [N+1 Query Problem](https://supabase.com/docs/guides/database/query-optimization)
