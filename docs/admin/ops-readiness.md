# Admin panel ops readiness

Verify these on **both** Supabase projects (dev and main) before treating the admin panel as production-ready.

## Database objects

| Object | Migration(s) | Symptom if missing |
| --- | --- | --- |
| `admin_dashboard_metrics` (materialized view) | `20260502120000_admin_panel_phase1.sql`, later MV updates | Dashboard shows "Metrics view not available yet" |
| `operator_jobs` table | `20260515130000_admin_phase8_operational.sql` (and related) | Bulk re-init returns operator jobs unavailable |
| pg_cron refresh for dashboard MV | Phase 1 migration | Stale KPI numbers |
| pg_cron `process-operator-jobs` | `20260516100000_internal_http_routes_pg_cron.sql` | Jobs queue never drains |

## Vault / cron (Supabase)

- `app_base_url`: app origin for internal HTTP routes
- `cron_secret`: Bearer token for `/api/internal/admin/*` cron targets

## Vercel / server environment

| Variable | Required for |
| --- | --- |
| `DATABASE_URL` | All admin pages and SQL console (read) |
| `ADMIN_EMAIL` | Admin login; broadcast/template test sends |
| `ADMIN_PASSWORD_HASH_B64` | Admin login (production; plain `ADMIN_PASSWORD` is dev-only) |
| `ADMIN_JWT_SECRET` or `ADMIN_JWT_SECRET_v1` | Admin session JWT |
| `ADMIN_TOTP_SECRET` | 2FA when enabled |
| `ADMIN_IP_ALLOWLIST` | Optional IP restriction |
| `ADMIN_SQL_WRITE_ENABLED` | SQL console writable mode |
| `ADMIN_SQL_WRITE_ALLOWLIST_TABLES` | Writable table allowlist |

## Smoke checklist

1. Sign in at `/admin/login`
2. Dashboard KPIs load
3. Performance → Tools → start bulk re-init; row appears under System → Jobs
4. System → Integrity → Run one check from UI
5. System → Jobs → Queues → Pause and resume a queue
