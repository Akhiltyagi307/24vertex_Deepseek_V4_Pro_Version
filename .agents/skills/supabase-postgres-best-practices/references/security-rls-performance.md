---
title: Optimize RLS Policies for Performance
impact: HIGH
impactDescription: 5-10x faster RLS queries with proper patterns
tags: rls, performance, security, optimization
designReference: ../../ui-craft/references/design-v2.md
---

## Optimize RLS Policies for Performance

Poorly written RLS policies can cause severe performance issues. Use subqueries and indexes strategically.

**Incorrect (function called for every row):**

```sql
create policy orders_policy on orders
  using (auth.uid() = user_id);  -- auth.uid() called per row!

-- With 1M rows, auth.uid() is called 1M times
```

**Correct (wrap functions in SELECT):**

```sql
create policy orders_policy on orders
  using ((select auth.uid()) = user_id);  -- Called once, cached

-- 100x+ faster on large tables
```

Use security definer functions for complex checks:

```sql
-- Create helper function (runs as definer, bypasses RLS)
create or replace function is_team_member(team_id bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = $1 and user_id = (select auth.uid())
  );
$$;

-- Use in policy (indexed lookup, not per-row check)
create policy team_orders_policy on orders
  using ((select is_team_member(team_id)));
```

Always add indexes on columns used in RLS policies:

```sql
create index orders_user_id_idx on orders (user_id);
```


---

## UI & presentation (Supabase Design System v2)

When this Postgres/Supabase work surfaces in product UI—Studio-style tables, SQL editor, metrics, or dashboards—use **[design-v2.md](../../ui-craft/references/design-v2.md)** as the canonical design reference: CSS variables and tokens; typography (JetBrains Mono for UUIDs, numerics, SQL); data tables (NULL and UUID styling per §3.3 and §8.7); SQL syntax palette (§10); charts, toasts, modals; dark-first layout; motion and icons (§16–§17). Accessibility: §7 (focus rings, contrast). Prefer CSS variables (`--brand`, `--foreground-*`) over raw hex in components.

Reference: [RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
