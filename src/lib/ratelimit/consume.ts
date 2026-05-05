import "server-only";

import { ratelimitSql } from "@/db";

import { isCircuitFailClosedMode, isCircuitOpen, recordFailure, recordSuccess } from "./circuit-breaker";
import { isCachedDenied, recordDeny } from "./lru";

export interface RlConsumeArgs {
	/** Caller-defined key, e.g. `doubt:user:<uuid>` or `admin-login:ip:<ip>`. */
	key: string;
	/** Max events allowed in the window. */
	limit: number;
	/** Window size in seconds (fixed-window). */
	windowSec: number;
}

export interface RlConsumeResult {
	allowed: boolean;
	remaining: number;
	resetAt: Date;
	/**
	 * Set when the verdict was not produced by a fresh DB call.
	 * - `circuit_open`: rate-limit DB has been flaky, defaulting to allow.
	 * - `circuit_fail_closed`: rate-limit DB has been flapping; defaulting
	 *   to deny so an attacker can't trigger DB errors specifically to
	 *   bypass the rate limit.
	 */
	degraded?: "circuit_open" | "circuit_fail_closed";
}

interface RlConsumeRow {
	allowed: boolean;
	remaining: number;
	reset_at: Date | string;
}

function failOpen(windowSec: number): RlConsumeResult {
	return {
		allowed: true,
		remaining: 0,
		resetAt: new Date(Date.now() + windowSec * 1000),
		degraded: "circuit_open",
	};
}

/**
 * Sustained flap → treat the rate-limit infra as unavailable and DENY.
 * Single transient blip still falls through to `failOpen`. Callers
 * receive `degraded: "circuit_fail_closed"` so they can emit the right
 * status code (typically 503) and surface a "service degraded" UX.
 */
function failClosed(windowSec: number): RlConsumeResult {
	return {
		allowed: false,
		remaining: 0,
		resetAt: new Date(Date.now() + windowSec * 1000),
		degraded: "circuit_fail_closed",
	};
}

/**
 * Atomic single-call rate-limit check. Order of operations:
 *
 * 1. LRU fast path — if this key was just denied, return cached deny without
 *    touching Postgres. Cache only stores denies, never grants.
 * 2. Circuit breaker — if rl_consume has been failing recently, fail-open.
 *    The user is still subject to the eventual DB-side cap once the breaker
 *    closes; we just don't 429 them on transient infrastructure issues.
 * 3. Real call to public.rl_consume — atomic upsert in one round-trip.
 */
export async function rlConsume(args: RlConsumeArgs): Promise<RlConsumeResult> {
	if (isCachedDenied(args.key)) {
		return {
			allowed: false,
			remaining: 0,
			resetAt: new Date(Date.now() + 1000),
		};
	}

	// Sustained-flap → fail closed. Checked BEFORE the per-call
	// `isCircuitOpen()` shortcut so a flapping breaker can't slip through
	// just because the current window happens to be cooled down.
	if (isCircuitFailClosedMode()) {
		return failClosed(args.windowSec);
	}

	if (isCircuitOpen()) {
		return failOpen(args.windowSec);
	}

	try {
		const rows = await ratelimitSql<RlConsumeRow[]>`
			select allowed, remaining, reset_at
			from public.rl_consume(${args.key}, ${args.limit}, ${args.windowSec})
		`;
		recordSuccess();
		const row = rows[0];
		if (!row) {
			throw new Error("rl_consume returned empty result");
		}
		const resetAt = row.reset_at instanceof Date ? row.reset_at : new Date(row.reset_at);
		if (!row.allowed) {
			recordDeny(args.key);
		}
		return {
			allowed: row.allowed,
			remaining: row.remaining,
			resetAt,
		};
	} catch (err) {
		recordFailure(err);
		// recordFailure may have just escalated us into fail-closed mode;
		// re-check before returning so the very call that triggered the
		// escalation respects the new policy.
		if (isCircuitFailClosedMode()) {
			return failClosed(args.windowSec);
		}
		return failOpen(args.windowSec);
	}
}
