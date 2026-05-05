import "server-only";

import * as Sentry from "@sentry/nextjs";

import { clientIpForPostgresInet } from "@/lib/admin/ip-sanitize";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import type { AdminActionName } from "./audit-actions";

export type AdminAuditInput = {
	/**
	 * Either a known constant from `ADMIN_ACTIONS` (preferred for new code) or
	 * a free-form string for legacy call sites still being migrated. Once
	 * every call site uses a constant, this can tighten to `AdminActionName`.
	 */
	action: AdminActionName | string;
	targetType?: string | null;
	targetId?: string | null;
	payload?: Record<string, unknown> | null;
	ipAddress?: string | null;
	userAgent?: string | null;
	totpUsed?: boolean;
};

const RETRY_DELAYS_MS = [50, 200, 600] as const;

async function attemptInsert(input: AdminAuditInput): Promise<{ ok: true } | { ok: false; reason: string }> {
	try {
		const supabase = createServiceRoleClient();
		const { error } = await supabase.from("admin_action_log").insert({
			action: input.action,
			target_type: input.targetType ?? null,
			target_id: input.targetId ?? null,
			payload: input.payload ?? null,
			ip_address: clientIpForPostgresInet(input.ipAddress),
			user_agent: input.userAgent ?? null,
			totp_used: input.totpUsed ?? false,
		});
		if (error) return { ok: false, reason: error.message ?? "supabase_error" };
		return { ok: true };
	} catch (e) {
		return { ok: false, reason: e instanceof Error ? e.message : String(e) };
	}
}

/**
 * Insert an admin audit row, retrying transient failures up to three times
 * with exponential backoff (50ms, 200ms, 600ms — total ≤ 850ms). Returns
 * `true` on success and `false` after retry exhaustion. Never throws — see
 * `writeAdminActionStrict` for callers that need to fail-closed.
 *
 * Why two variants:
 *   - Login / logout / panic flows can't hard-block on a flaky audit DB —
 *     a sign-in that 5xx's because the audit table isn't writable is worse
 *     than a missing audit row. Those keep using this swallowing variant.
 *   - Destructive operations (refunds, hard-deletes, broadcast sends) MUST
 *     fail-closed: an admin action that proceeds with no audit trail is a
 *     compliance hole. Those use `writeAdminActionStrict`.
 */
export async function writeAdminAction(input: AdminAuditInput): Promise<boolean> {
	for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
		const r = await attemptInsert(input);
		if (r.ok) return true;
		if (attempt < RETRY_DELAYS_MS.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
		}
	}
	Sentry.captureMessage("admin_audit_retry_exhausted", {
		level: "error",
		tags: { feature: "admin", phase: "audit_insert" },
		extra: { action: input.action, target_type: input.targetType, target_id: input.targetId },
	});
	return false;
}

/**
 * Strict variant: same retry policy as `writeAdminAction` but THROWS after
 * exhaustion. Callers that wrap a destructive operation must use this so
 * a missing audit row aborts the request with a 5xx instead of completing
 * silently.
 *
 * Pattern:
 *   await writeAdminActionStrict({ action: ADMIN_ACTIONS.PAYMENT_REFUND, ... });
 *   // mutation only happens after audit row is committed.
 */
export class AdminAuditWriteError extends Error {
	constructor(action: string, reason: string) {
		super(`Failed to write audit row for "${action}": ${reason}`);
		this.name = "AdminAuditWriteError";
	}
}

export async function writeAdminActionStrict(input: AdminAuditInput): Promise<void> {
	let lastReason = "unknown";
	for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
		const r = await attemptInsert(input);
		if (r.ok) return;
		lastReason = r.reason;
		if (attempt < RETRY_DELAYS_MS.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
		}
	}
	const err = new AdminAuditWriteError(String(input.action), lastReason);
	Sentry.captureException(err, {
		tags: { feature: "admin", phase: "audit_insert_strict" },
		extra: { action: input.action, target_type: input.targetType, target_id: input.targetId, reason: lastReason },
	});
	throw err;
}
