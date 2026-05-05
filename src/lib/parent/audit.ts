import "server-only";

import * as Sentry from "@sentry/nextjs";

import { clientIpForPostgresInet } from "@/lib/admin/ip-sanitize";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import type { ParentActionName } from "./audit-actions";

export type ParentAuditInput = {
	/**
	 * Either a known constant from `PARENT_ACTIONS` (preferred) or a free-form
	 * string until every call site uses a constant. Once stable this can
	 * tighten to `ParentActionName`.
	 */
	action: ParentActionName | string;
	parentId: string;
	targetType?: string | null;
	targetId?: string | null;
	payload?: Record<string, unknown> | null;
	ipAddress?: string | null;
	userAgent?: string | null;
};

const RETRY_DELAYS_MS = [50, 200, 600] as const;

async function attemptInsert(
	input: ParentAuditInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	try {
		const supabase = createServiceRoleClient();
		const { error } = await supabase.from("parent_audit").insert({
			parent_id: input.parentId,
			action: input.action,
			target_type: input.targetType ?? null,
			target_id: input.targetId ?? null,
			payload: input.payload ?? null,
			ip_address: clientIpForPostgresInet(input.ipAddress),
			user_agent: input.userAgent ?? null,
		});
		if (error) return { ok: false, reason: error.message ?? "supabase_error" };
		return { ok: true };
	} catch (e) {
		return { ok: false, reason: e instanceof Error ? e.message : String(e) };
	}
}

/**
 * Insert a parent_audit row, retrying transient failures up to three times
 * with exponential backoff (50ms, 200ms, 600ms — total ≤ 850ms). Returns
 * `true` on success and `false` after retry exhaustion. Never throws.
 *
 * Why no `Strict` variant (cf. `writeAdminActionStrict`):
 *   Parent server actions issue `redirect()` after their core RPC commits.
 *   A flaky audit DB shouldn't break navigation for the user — the right
 *   trade is a Sentry alert plus best-effort retry. If a future parent
 *   action handles money or hard-deletes data, mirror the strict pattern
 *   from admin/audit.ts at that call site.
 */
export async function writeParentAudit(input: ParentAuditInput): Promise<boolean> {
	for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
		const r = await attemptInsert(input);
		if (r.ok) return true;
		if (attempt < RETRY_DELAYS_MS.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
		}
	}
	Sentry.captureMessage("parent_audit_retry_exhausted", {
		level: "error",
		tags: { feature: "parent", phase: "audit_insert" },
		extra: { action: input.action, parent_id: input.parentId },
	});
	return false;
}
