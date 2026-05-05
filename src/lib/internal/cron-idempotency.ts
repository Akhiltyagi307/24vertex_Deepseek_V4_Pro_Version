import "server-only";

import * as Sentry from "@sentry/nextjs";

import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Cron idempotency primitive.
 *
 * pg_cron failover, manual replay from the admin panel, and "I clicked the
 * run-now button twice" all produce duplicate firings of the same cron run.
 * The cost ranges from harmless (idempotent SQL) to user-visible (two trial
 * reminder emails) to compliance-flagged (a duplicate compliance retention
 * sweep). We close that gap by giving each firing an `Idempotency-Key`
 * header and inserting a row in `cron_run_log` keyed on it. A duplicate
 * insert short-circuits the route before any work runs.
 *
 * Header semantics:
 *   - The pg_cron migration that schedules a route includes a generated key
 *     (typically `concat(<route>, '-', date_trunc(...))`) so a re-fire of
 *     the same scheduled run uses the same key.
 *   - Admin-panel "run now" affordances generate a UUID and pass it in the
 *     header. They explicitly differ from the scheduled key so an admin
 *     replay isn't deduped against the most recent scheduled run.
 *   - The key must be 8–200 chars (the DB CHECK enforces this).
 *
 * This module is service-role only because it talks to a service-role
 * client to insert into `public.cron_run_log` (RLS denies all other
 * roles by design — see `20260526120000_cron_run_log.sql`).
 */

const MAX_KEY_LEN = 200;
const MIN_KEY_LEN = 8;

export class CronIdempotencyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CronIdempotencyError";
	}
}

export type CronIdempotencyVerdict =
	/** Caller didn't supply the header — proceed without dedup (logged). */
	| { kind: "no_key"; reason: string }
	/** First time this key has fired — caller should run, then call `completeCronRun`. */
	| { kind: "fresh" }
	/** Already processed (or in-flight) — caller must short-circuit. */
	| { kind: "duplicate"; firstSeenAt: string; completedAt: string | null };

/**
 * Read the `Idempotency-Key` header. Returns null when the header is missing
 * or fails the length check. The caller decides what to do with that —
 * historically cron routes ran without idempotency, so we keep that
 * fallback rather than rejecting.
 */
export function readIdempotencyKey(request: Request): string | null {
	const raw = request.headers.get("idempotency-key");
	if (!raw) return null;
	const trimmed = raw.trim();
	if (trimmed.length < MIN_KEY_LEN || trimmed.length > MAX_KEY_LEN) return null;
	return trimmed;
}

/**
 * Try to claim a fresh slot for `key` against `cronRoute`. On success the
 * caller proceeds with the work and finishes by calling `completeCronRun`.
 * On duplicate, the caller MUST return early without doing anything that
 * would re-fire the side effect.
 *
 * Why we don't throw on duplicate: cron routes are http endpoints; the
 * caller always wants to return a 200 (`{ ok: true, deduped: true }`) so
 * pg_cron logs a successful invocation and doesn't retry the firing.
 */
export async function beginCronRun(args: { cronRoute: string; key: string | null }): Promise<CronIdempotencyVerdict> {
	if (!args.key) {
		return { kind: "no_key", reason: "missing or invalid Idempotency-Key header" };
	}

	const supabase = createServiceRoleClient();
	const { error } = await supabase.from("cron_run_log").insert({
		idempotency_key: args.key,
		cron_route: args.cronRoute,
	});

	if (!error) {
		return { kind: "fresh" };
	}

	// 23505 = unique_violation. Any other error means the dedup ledger isn't
	// available; log + fall back to "no_key" so the caller can decide whether
	// to proceed or refuse based on its own policy. We do not silently treat
	// arbitrary insert failures as duplicates — that would let a flaky DB
	// suppress legitimate runs.
	const isUniqueViolation = error.code === "23505";
	if (!isUniqueViolation) {
		Sentry.captureException(new CronIdempotencyError(`begin failed: ${error.message}`), {
			tags: { component: "cron.idempotency", phase: "begin", route: args.cronRoute },
			extra: { key: args.key, code: error.code },
		});
		return { kind: "no_key", reason: `ledger insert failed: ${error.message}` };
	}

	const { data: existing } = await supabase
		.from("cron_run_log")
		.select("started_at, completed_at")
		.eq("idempotency_key", args.key)
		.maybeSingle();

	return {
		kind: "duplicate",
		firstSeenAt: existing?.started_at ?? new Date(0).toISOString(),
		completedAt: existing?.completed_at ?? null,
	};
}

/**
 * Mark a previously-claimed run as complete. Optional `result` is a small
 * JSON snapshot of what the cron did — sender counts, processed counts,
 * error count. Failure to write the completion row is non-fatal: we log
 * to Sentry but don't undo the claim, since claiming + doing-work is the
 * actually important part. If completion never lands, the row sits with
 * `completed_at IS NULL`, which is itself a useful signal in admin views.
 */
export async function completeCronRun(args: {
	key: string;
	result?: Record<string, unknown> | null;
}): Promise<void> {
	const supabase = createServiceRoleClient();
	const { error } = await supabase
		.from("cron_run_log")
		.update({ completed_at: new Date().toISOString(), result: args.result ?? null })
		.eq("idempotency_key", args.key);
	if (error) {
		Sentry.captureException(new CronIdempotencyError(`complete failed: ${error.message}`), {
			tags: { component: "cron.idempotency", phase: "complete" },
			extra: { key: args.key },
		});
	}
}
