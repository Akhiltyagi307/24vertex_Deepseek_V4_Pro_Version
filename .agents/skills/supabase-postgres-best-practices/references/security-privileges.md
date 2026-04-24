---
title: Apply Principle of Least Privilege
impact: MEDIUM
impactDescription: Reduced attack surface, better audit trail
tags: privileges, security, roles, permissions
designReference: ../../ui-craft/references/design-v2.md
---

## Apply Principle of Least Privilege

Grant only the minimum permissions required. Never use superuser for application queries.

**Incorrect (overly broad permissions):**

```sql
-- Application uses superuser connection
-- Or grants ALL to application role
grant all privileges on all tables in schema public to app_user;
grant all privileges on all sequences in schema public to app_user;

-- Any SQL injection becomes catastrophic
-- drop table users; cascades to everything
```

**Correct (minimal, specific grants):**

```sql
-- Create role with no default privileges
create role app_readonly nologin;

-- Grant only SELECT on specific tables
grant usage on schema public to app_readonly;
grant select on public.products, public.categories to app_readonly;

-- Create role for writes with limited scope
create role app_writer nologin;
grant usage on schema public to app_writer;
grant select, insert, update on public.orders to app_writer;
grant usage on sequence orders_id_seq to app_writer;
-- No DELETE permission

-- Login role inherits from these
create role app_user login password 'xxx';
grant app_writer to app_user;
```

Revoke public defaults:

```sql
-- Revoke default public access
revoke all on schema public from public;
revoke all on all tables in schema public from public;
```


---

## UI & presentation (Supabase Design System v2)

When this Postgres/Supabase work surfaces in product UI—Studio-style tables, SQL editor, metrics, or dashboards—use **[design-v2.md](../../ui-craft/references/design-v2.md)** as the canonical design reference: CSS variables and tokens; typography (JetBrains Mono for UUIDs, numerics, SQL); data tables (NULL and UUID styling per §3.3 and §8.7); SQL syntax palette (§10); charts, toasts, modals; dark-first layout; motion and icons (§16–§17). Accessibility: §7 (focus rings, contrast). Prefer CSS variables (`--brand`, `--foreground-*`) over raw hex in components.

Reference: [Roles and Privileges](https://supabase.com/blog/postgres-roles-and-privileges)
