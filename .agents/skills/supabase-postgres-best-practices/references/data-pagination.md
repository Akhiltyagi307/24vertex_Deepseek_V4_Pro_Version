---
title: Use Cursor-Based Pagination Instead of OFFSET
impact: MEDIUM-HIGH
impactDescription: Consistent O(1) performance regardless of page depth
tags: pagination, cursor, keyset, offset, performance
designReference: ../../ui-craft/references/design-v2.md
---

## Use Cursor-Based Pagination Instead of OFFSET

OFFSET-based pagination scans all skipped rows, getting slower on deeper pages. Cursor pagination is O(1).

**Incorrect (OFFSET pagination):**

```sql
-- Page 1: scans 20 rows
select * from products order by id limit 20 offset 0;

-- Page 100: scans 2000 rows to skip 1980
select * from products order by id limit 20 offset 1980;

-- Page 10000: scans 200,000 rows!
select * from products order by id limit 20 offset 199980;
```

**Correct (cursor/keyset pagination):**

```sql
-- Page 1: get first 20
select * from products order by id limit 20;
-- Application stores last_id = 20

-- Page 2: start after last ID
select * from products where id > 20 order by id limit 20;
-- Uses index, always fast regardless of page depth

-- Page 10000: same speed as page 1
select * from products where id > 199980 order by id limit 20;
```

For multi-column sorting:

```sql
-- Cursor must include all sort columns
select * from products
where (created_at, id) > ('2024-01-15 10:00:00', 12345)
order by created_at, id
limit 20;
```


---

## UI & presentation (Supabase Design System v2)

When this Postgres/Supabase work surfaces in product UI—Studio-style tables, SQL editor, metrics, or dashboards—use **[design-v2.md](../../ui-craft/references/design-v2.md)** as the canonical design reference: CSS variables and tokens; typography (JetBrains Mono for UUIDs, numerics, SQL); data tables (NULL and UUID styling per §3.3 and §8.7); SQL syntax palette (§10); charts, toasts, modals; dark-first layout; motion and icons (§16–§17). Accessibility: §7 (focus rings, contrast). Prefer CSS variables (`--brand`, `--foreground-*`) over raw hex in components.

Reference: [Pagination](https://supabase.com/docs/guides/database/pagination)
