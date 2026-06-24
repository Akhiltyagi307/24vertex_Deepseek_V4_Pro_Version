# Phase 4 Runbook — Move Production DB to Mumbai (ap-south-1)

> **Objective:** eliminate the cross-region penalty. Today: Vercel functions in **bom1 (Mumbai)**, prod DB in **ap-southeast-2 (Sydney)** → every query + every `getUser()` is a ~150 ms Mumbai↔Sydney round-trip, paid many times per page. After this: functions **and** DB both in Mumbai → each DB round-trip drops to ~1–5 ms. This is the single biggest latency win in the whole plan.
>
> **Method:** Supabase region is fixed per project, so we stand up a **new prod project in ap-south-1 (Pro plan)** and migrate onto it. The cutover is just an **env-var flip** (the domain stays on Vercel; no DNS change).
>
> **Audience:** the engineer/agent executing the migration. Do NOT run any of this without an agreed maintenance window and the T4.0 sign-off. Rehearse end-to-end on a throwaway project first.

---

## 0. Pre-flight inventory (captured from prod `suwakggcbxmmvqzeudmq`, 2026-06-24)

This is what must move. The numbers are small — the risk is *completeness*, not volume.

| Item | Value | Migration concern |
|---|---|---|
| DB size | **272 MB** total (public 79 MB, auth 2.5 MB, storage-meta 0.9 MB; rest = cron/net/vault/realtime + `net._http_response` bloat) | logical dump/restore is fast |
| Postgres | **17** (both projects) | same major version → clean dump/restore |
| public schema | **72 tables, 237 functions/RPCs, 1 matview** | recreated by replaying `supabase/migrations/**` |
| Auth users | **2, all `email` provider** (no OAuth/SSO/phone) | trivial; but JWT secret changes → all sessions invalidated |
| Storage buckets | **5**: `student-test-reports` (private, 151 files/43 MB), `doubt-attachments` (private, 4 files/12 MB), `avatars` (public, empty), `compliance-exports` (private, zip-only, empty), `organization-favicons` (public, image-only, empty) | bucket **config** (public flag, size/MIME limits) + **RLS** + **file bytes** all move separately from the DB dump |
| Extensions | `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`, **`vector` (pgvector)**, `pg_cron`, `pg_net`, `postgres_fdw`, `dblink` | enable on new project; **pgvector indexes** must be recreated |
| pgvector columns | `topic_context_chunks.embedding`, `content_blacklist.embedding`, `questions.embedding` | embeddings data + ANN indexes must transfer |
| **Vault secrets** | **`app_base_url`, `cron_secret`** | ⚠️ Vault values are encrypted with a **project-specific root key** — they do **NOT** survive a logical dump. Must be **re-created with plaintext** on the new project. |
| **pg_cron jobs** | **19 active jobs** — most `net.http_post(app_base_url || '/api/internal/...')` authenticated via the `cron_secret` Vault secret; plus job that `REFRESH MATERIALIZED VIEW CONCURRENTLY admin_dashboard_metrics` every minute, a `rate_limit_buckets` cleanup, and a `teacher_class_insights` cleanup | recreate all 19; they depend on the Vault secrets above |
| Materialized view | `public.admin_dashboard_metrics` (refreshed concurrently every minute) | must be **populated once (non-concurrent)** before the concurrent-refresh cron works |
| Foreign servers | **none** (postgres_fdw/dblink installed but unused) | nothing to reconfigure |
| DB webhooks / net triggers | **none** (all async HTTP is via cron, not row triggers) | nothing extra |
| External webhooks | Razorpay, Resend → point at the **app domain** (`24vertex.in/api/...`), which does **not** change | no webhook reconfig needed |

**Implication:** the genuinely manual, dump-won't-carry-it pieces are: **(1) Vault secret values, (2) project/Auth config, (3) storage file bytes, (4) matview populate, (5) pgvector indexes, (6) cron jobs if any were created outside migrations.** Everything else rides along in the logical dump or the migration replay.

---

## 1. T4.0 — Decision checkpoint (blocker — get explicit sign-off)

Confirm with the owner before provisioning anything:
- [ ] Accept a **maintenance window** (data is tiny; expect <30 min of write-freeze, schedule at lowest-traffic hour — IST early morning).
- [ ] Accept moving to **Supabase Pro** (~$25/mo) for the new project (also stops the free-tier auto-pause).
- [ ] Accept that **all current users are logged out at cutover** (new project = new JWT secret). With only 2 users today this is negligible; document it for when the user base is larger. *(Optional advanced: copy the old project's JWT secret to the new project to preserve sessions — skip unless the user count makes it worthwhile.)*
- [ ] Target region confirmed: **`ap-south-1` (Mumbai)** to co-locate with `bom1` functions.
- [ ] A **2-hour block** for the rehearsal + a separate block for the real cutover.

> While provisioning, **enable JWT signing keys (asymmetric)** on the new project from day one — this also unblocks Phase 3 (T3.1, `getClaims`).

---

## 2. Tools & credentials you need

- `psql`, `pg_dump`, `pg_restore` (Postgres **17** client — match the server major version).
- Supabase CLI (`supabase`) logged in.
- Old prod DB connection string (**direct** `:5432`, not the pooler — pooler can't do consistent dumps). Get from Supabase dashboard → old project → Connect → "Direct connection".
- New project DB connection string (direct, once provisioned).
- `rclone` **or** the Supabase CLI storage commands for copying bucket objects.
- The plaintext values of the two Vault secrets (`app_base_url`, `cron_secret`) — retrieve **before** you start (see step 5).
- Access to Vercel env vars (to repoint) and to the Supabase dashboards of both projects.

---

## 3. T4.1 — Provision the new project

1. Create a new Supabase project: **region `ap-south-1`**, **Pro** plan, a clearly distinct name (e.g. `vertex24-prod-bom1`). Choose a **strong DB password** and store it in your secret manager.
2. Wait until healthy. Record: project ref, anon/publishable key, service-role key, JWT settings.
3. **Enable JWT signing keys (asymmetric)** (Settings → Auth → JWT keys / signing keys).
4. **Verify** region == `ap-south-1` via the API or dashboard before continuing.

---

## 4. T4.2 — Replicate project CONFIG (the non-database settings)

These live in project settings, **not** in any SQL dump. Replicate from old → new by hand, screenshot-for-screenshot:
- [ ] **Auth → URL config:** Site URL (`https://www.24vertex.in`) and the full **Redirect URLs allow-list** (auth callbacks, password reset, etc.). Miss this and login redirects break.
- [ ] **Auth → Providers:** only **Email** is in use — confirm email signups/confirmations settings match (confirm-email on/off, secure email change, etc.).
- [ ] **Auth → Email templates** (confirm signup, reset, magic link, email change) — copy any customizations.
- [ ] **Auth → SMTP:** if a custom SMTP (e.g. Resend SMTP) is configured, replicate it; otherwise it falls back to Supabase's limited built-in sender.
- [ ] **Auth → rate limits / session/JWT expiry** — match.
- [ ] **API settings, Network restrictions / allowed IPs** (if any), **Database → SSL enforcement** — match.
- [ ] **Storage settings** (global file size limit, image transformation) — match.
- [ ] Note both projects' **anon + service-role keys**; you'll swap them in the app at cutover.

---

## 5. T4.3 — Retrieve Vault secret plaintexts (do this while old prod is live)

Vault values are encrypted with the old project's root key and will **not** decrypt after a logical restore. Capture the plaintext now (run on **old prod**, via the SQL editor — do not paste the values into logs/chat):

```sql
select name, decrypted_secret from vault.decrypted_secrets where name in ('app_base_url','cron_secret');
```

- `app_base_url` should be `https://www.24vertex.in` (the base the cron jobs POST to).
- `cron_secret` authenticates those internal cron calls and must **equal the app's CRON secret env var**. Keep the same value so the app env doesn't need to change.

You will re-insert these on the new project in step 9.

---

## 6. T4.4 — Rehearse: full dump → restore into a SCRATCH project

Do the entire data path once on a throwaway project (any region) before touching the real new project. This catches dump/restore ordering issues with auth/storage with zero risk.

Recommended mechanics (follow the current official guide: Supabase docs → "Migrating and upgrading projects" / "Migrate from one project to another" — flags evolve, so prefer the doc over hard-coding them):

```bash
OLD="postgresql://postgres:<pwd>@db.suwakggcbxmmvqzeudmq.supabase.co:5432/postgres"
NEW="postgresql://postgres:<pwd>@db.<newref>.supabase.co:5432/postgres"

# 1. roles (skip Supabase-managed roles; usually --role-only is unnecessary here since no custom app roles)
# 2. schema + data for the public schema and the Supabase-managed auth/storage DATA:
supabase db dump --db-url "$OLD" -f schema.sql                 # DDL (public; Supabase excludes managed internals)
supabase db dump --db-url "$OLD" -f data.sql --use-copy --data-only
#    auth + storage rows (users, identities, buckets, objects metadata):
pg_dump "$OLD" --data-only --schema=auth --schema=storage --no-owner --no-privileges -f auth_storage_data.sql

# restore into NEW (single transaction so a failure rolls back cleanly):
psql "$NEW" --single-transaction -f schema.sql
psql "$NEW" --single-transaction -f data.sql
psql "$NEW" --single-transaction -f auth_storage_data.sql
```

> **Alternative (cleaner for this repo):** since the schema is fully captured in `supabase/migrations/**`, you can instead **replay the migrations** on the new project for the schema (guarantees the schema matches source control, including the Phase 2 indexes/RLS), then load **`--data-only`** for public + auth + storage. Pick ONE schema source (dump *or* migrations), not both. The migration-replay path is preferable because it reproduces the 19 cron jobs and the matview definition that live in the `*_pg_cron` / dashboard-metrics migrations.

**Rehearsal acceptance:** on the scratch project — row counts match per table, a test user can log in, RLS blocks cross-user reads, pgvector queries return, the matview populates. Only when the rehearsal is clean do you run the real thing.

---

## 7. Real migration — execute in the window

### 7a. T4.5 — Freeze writes on old prod
- Enable the app's maintenance mode: set Vercel env `MAINTENANCE_MODE` (the app already redirects via `shouldRedirectToMaintenance` in `proxy.ts`). Redeploy or use an instant env toggle.
- **Pause the 19 cron jobs** on old prod so nothing mutates mid-dump: `select cron.unschedule(jobid) ...` is heavy-handed; simpler — they'll stop mattering once you cut over, but to be safe disable them: `update cron.job set active=false;` on old prod (re-enable on rollback).
- Confirm no active writes (check `pg_stat_activity`).

### 7b. Dump → restore onto the REAL new project
Run the rehearsed path against the real new project. With 272 MB this takes minutes.

### 7c. T4.3(b) — Recreate Vault secrets on new project
```sql
select vault.create_secret('https://www.24vertex.in', 'app_base_url');
select vault.create_secret('<same cron_secret value as old>', 'cron_secret');
```
Verify: `select name from vault.secrets;` returns both.

### 7d. Extensions + pgvector indexes
- Confirm all extensions present: `pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault, vector, pg_cron, pg_net, postgres_fdw, dblink`.
- Recreate the ANN indexes on the 3 embedding columns if the dump didn't carry them (the schema dump / migrations should). Verify: `select indexname from pg_indexes where indexdef ilike '%using hnsw%' or indexdef ilike '%using ivfflat%';` matches old prod.

### 7e. Cron jobs
- Verify **19** jobs exist and are `active` and point at the new Vault `app_base_url`: `select count(*), bool_and(active) from cron.job;`
- If the migration replay created them, great. If you used pure dump/restore, the `cron.job` rows come across but **double-check pg_cron actually scheduled them** on the new instance (cron.job is sometimes instance-specific). Re-`cron.schedule` any that aren't live.

### 7f. Materialized view populate
The per-minute cron uses `REFRESH ... CONCURRENTLY`, which fails on an unpopulated matview. Populate once, non-concurrently:
```sql
refresh materialized view public.admin_dashboard_metrics;
```
Verify it returns rows and that a concurrent refresh now succeeds.

### 7g. Storage file bytes
Copy the actual objects (only 2 buckets have content; ~55 MB total):
```bash
# using rclone with both projects' S3-compatible storage endpoints + service keys, OR:
supabase storage cp --recursive ss://student-test-reports ... # old -> new, per bucket
```
Buckets to copy content for: `student-test-reports` (151 files), `doubt-attachments` (4 files). Recreate **bucket config + RLS** for ALL 5 (public flag, size/MIME limits) — the storage data dump carries `storage.buckets` rows + `storage.objects` metadata, but **verify the bytes landed** and that bucket RLS policies exist (re-run the storage-policy migrations if needed: `*_storage.sql`).

---

## 8. T4.4(b) — Pre-cutover verification on the new project (gate)

Point a **Vercel preview** deployment at the new project (preview-scoped env vars: `NEXT_PUBLIC_SUPABASE_URL`, anon key, service-role key, `DATABASE_URL` = new **ap-south-1 pooler** `:6543` `pgbouncer=true`, `DATABASE_RATELIMIT_URL`). Then verify against the preview:

- [ ] Per-table row counts match old prod (spot-check the big ones: `tests`, `student_answers`, `performance_tracker`, `profiles`, `subscriptions`).
- [ ] A real student logs in; sees their tests/reports/performance. A linked parent sees the child. A teacher sees their roster. (RLS intact.)
- [ ] A known student-test-report **PDF downloads**; a **doubt attachment opens** (storage bytes present).
- [ ] A doubt-chat / practice generation round-trip works (DeepSeek unaffected; just confirms DB writes).
- [ ] `get_advisors` (performance) on the new project shows the **post-Phase-2** clean counts.
- [ ] Cron: manually trigger one internal endpoint via the cron command and confirm a 200 (validates `app_base_url` + `cron_secret`).
- [ ] Run `pnpm test:e2e:student:local` pointed at the preview.

**Do not proceed to cutover until every box is checked.**

---

## 9. Cutover

1. Confirm old prod is still frozen (maintenance on, cron disabled).
2. **Final delta sync:** because writes were frozen at 7a, there should be no delta. If any trickled in, re-dump `--data-only` the changed tables. (With a clean freeze, skip.)
3. Flip **production** Vercel env vars to the new project (URL, anon key, service-role key, `DATABASE_URL` ap-south-1 pooler, `DATABASE_RATELIMIT_URL`). Keep `vercel.json` `regions: ["bom1"]`.
4. Redeploy production.
5. Turn **off** `MAINTENANCE_MODE`.
6. Smoke test on the live domain immediately (login, dashboard, one practice action).

> The app's image `remotePatterns` (`next.config.ts`) derives the Supabase hostname from `NEXT_PUBLIC_SUPABASE_URL`, so it follows automatically — no code change. Confirm avatars/favicons still render (they're served from the new project's public buckets).

---

## 10. Post-cutover — verify & watch (first 24–48h)

- [ ] **Re-run the T0.1 baseline** (authed TTFB per portal). Expect a large drop — DB round-trips are now intra-region (~2 ms vs ~150 ms). This is the proof the whole effort worked.
- [ ] Supabase (new) → Reports → Query Performance: confirm low latencies; connection count sane.
- [ ] Sentry: error rate flat; no spike in auth/login or DB-connection errors.
- [ ] Confirm cron jobs are firing on the new project (check `cron.job_run_details` for recent successes, and that internal endpoints get hit).
- [ ] Confirm Razorpay + Resend webhooks still deliver (they hit the unchanged app domain).
- [ ] Watch login success rate (users re-authenticate post-cutover due to new JWT secret — expected).

---

## 11. Rollback

Old prod is kept **online** (read-only or full) for **1–2 weeks** precisely so rollback is a flip, not a rebuild.

- **To roll back:** set Vercel prod env vars back to the **old** project, re-enable the old project's cron jobs (`update cron.job set active=true;`), redeploy, maintenance off.
- **Caveat:** any data written to the NEW project after cutover is lost on rollback. So decide fast — roll back within the first hours if a blocker appears, before meaningful new writes accumulate. (For a no-data-loss rollback you'd have to reverse-sync new→old, which defeats the purpose — treat rollback as "abort early.")
- Because users got new sessions on the new project, a rollback logs them out again — acceptable.

---

## 12. Decommission (after 1–2 weeks of healthy new-prod operation)

- [ ] Take a final backup of old prod, then **pause** (not delete) it for another few weeks.
- [ ] Update memory + the plan doc to record the new prod project ref/region and that Sydney is retired.
- [ ] Update `reference_supabase_projects` memory (prod ref changed).
- [ ] Delete old prod only once you're certain.

---

## 13. Master checklist (one line each)

```
[ ] T4.0  Sign-off: window + Pro + re-login accepted; region ap-south-1 confirmed
[ ] 2     Postgres 17 client tools + supabase CLI + rclone ready; both direct DB URLs
[ ] T4.1  New Pro project in ap-south-1; JWT signing keys enabled; region verified
[ ] T4.2  Project config replicated (Auth URLs, providers, templates, SMTP, storage, API, network)
[ ] T4.3a Vault plaintexts captured (app_base_url, cron_secret)
[ ] T4.4  Rehearsed full dump/restore on scratch project — accepted
[ ] 7a    Maintenance ON; old-prod cron disabled; no active writes
[ ] 7b    Dump → restore onto real new project (schema via migrations OR dump; data-only)
[ ] 7c    Vault secrets recreated on new project (both present)
[ ] 7d    Extensions present; pgvector ANN indexes recreated
[ ] 7e    19 cron jobs present, active, scheduled, pointing at new app_base_url
[ ] 7f    admin_dashboard_metrics populated (non-concurrent refresh); concurrent refresh works
[ ] 7g    Storage bytes copied (student-test-reports 151, doubt-attachments 4); 5 buckets' config+RLS verified
[ ] 8     Preview deploy → full pre-cutover verification (row counts, RLS, PDF, storage, advisors, cron, e2e) — ALL green
[ ] 9     Cutover: final delta (none) → flip prod env → redeploy → maintenance OFF → smoke
[ ] 10    Post-cutover: T0.1 TTFB drop confirmed; Sentry flat; cron firing; webhooks delivering
[ ] 11    Rollback path validated (know how to flip back)
[ ] 12    Decommission old prod after 1–2 weeks; update memory/plan
```

---

## 14. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vault secrets forgotten → all cron HTTP fails silently | Med | Step 5 + 7c explicit; verify cron run details in step 10 |
| Storage bytes not copied → broken PDFs/attachments | Med | Step 7g + pre-cutover download test (step 8) |
| pgvector indexes missing → slow/again-seq embedding search | Low | Step 7d verifies index list vs old |
| Auth/redirect config not replicated → login loops | Med | Step 4 checklist + step 8 login test on preview |
| matview unpopulated → admin dashboard cron errors every minute | Med | Step 7f one-time populate |
| Data delta during dump | Low | Hard write-freeze (7a) before dumping |
| Users surprised by logout | Low | Expected; communicate; only 2 users today |
| Cutover blocker discovered late | Low | Rehearsal (7) + full pre-cutover gate (8) + hot rollback (11) |

---

**Bottom line:** the data is tiny and external webhooks/DNS don't change, so the mechanical migration is short. The risk is entirely in **completeness** — the Vault secrets, the 19 cron jobs, the storage bytes, pgvector indexes, the matview populate, and the project-level Auth config. Work the checklist; gate hard at step 8; keep old prod hot for rollback.
