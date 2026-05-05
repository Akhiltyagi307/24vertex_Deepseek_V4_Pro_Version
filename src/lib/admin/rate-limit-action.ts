import "server-only";

import { rlConsume, type RlConsumeResult } from "@/lib/ratelimit/consume";

import type { AdminActionName } from "./audit-actions";

/**
 * Per-admin rate limit for high-blast-radius actions: refunds, broadcast
 * sends, hard deletes, impersonation. Built on top of the existing DB-side
 * `public.rl_consume` — no new migration, no new table.
 *
 * Why an admin-side limit at all when admin auth already gates these routes:
 *   1. A compromised admin token shouldn't be a money-loss event in
 *      seconds. Even slow-walked, an attacker calling /payments/[id]/refund
 *      hundreds of times per minute is materially worse than one or two.
 *   2. Bug-prevention. Operator UIs that double-submit a destructive form
 *      shouldn't fire the action twice; a 5-per-window cap absorbs that
 *      without changing the UX.
 *   3. Audit signal. Hitting this limit is itself a fact worth recording
 *      so an investigation can spot abuse patterns.
 *
 * The key shape (`admin:<action>:<scope>`) intentionally namespaces by
 * action so you can tune limits per-action and so tracing in `rl_buckets`
 * is grep-able. `scope` is whatever uniquely identifies the actor — admin
 * email, JWT id, or fall back to client IP.
 */

export interface AdminActionRateLimitArgs {
	action: AdminActionName;
	/** Stable scope (admin email/jti/ip). */
	scope: string;
	/** Max successful attempts in the window. Defaults to 5. */
	limit?: number;
	/** Window length in seconds. Defaults to 60. */
	windowSec?: number;
}

export interface AdminActionRateLimitVerdict {
	allowed: boolean;
	remaining: number;
	resetAt: Date;
	/** True when the verdict came from the failed-DB fallback. */
	degraded: boolean;
}

/**
 * Consume one slot from the per-action bucket. Failing closed isn't an option
 * here: when `rl_consume` is degraded, the existing rate-limit module already
 * fails open with `degraded: "circuit_open"`. We surface that explicitly so
 * callers can tag a Sentry breadcrumb but still proceed.
 */
export async function consumeAdminActionRateLimit(args: AdminActionRateLimitArgs): Promise<AdminActionRateLimitVerdict> {
	const limit = args.limit ?? 5;
	const windowSec = args.windowSec ?? 60;
	const result: RlConsumeResult = await rlConsume({
		key: `admin:${args.action}:${args.scope}`,
		limit,
		windowSec,
	});
	return {
		allowed: result.allowed,
		remaining: result.remaining,
		resetAt: result.resetAt,
		degraded: result.degraded === "circuit_open",
	};
}

/**
 * Compose a stable rate-limit scope from the things admin auth already
 * gives us. Prefers `jti` (per-session) so two admins on the same network
 * don't share a bucket; falls back to email then IP.
 */
export function adminActionScope(input: { jti?: string | null; email?: string | null; ip?: string | null }): string {
	const jti = input.jti?.trim();
	if (jti) return `jti:${jti}`;
	const email = input.email?.trim().toLowerCase();
	if (email) return `email:${email}`;
	const ip = input.ip?.trim();
	if (ip && ip !== "0.0.0.0") return `ip:${ip}`;
	return "scope:unknown";
}
