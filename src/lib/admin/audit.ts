import "server-only";

import * as Sentry from "@sentry/nextjs";

import { clientIpForPostgresInet } from "@/lib/admin/ip-sanitize";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type AdminAuditInput = {
	action: string;
	targetType?: string | null;
	targetId?: string | null;
	payload?: Record<string, unknown> | null;
	ipAddress?: string | null;
	userAgent?: string | null;
	totpUsed?: boolean;
};

/**
 * Append-only audit row. Never throws: failures are captured to Sentry so login flows still respond.
 */
export async function writeAdminAction(input: AdminAuditInput): Promise<void> {
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
		if (error) {
			Sentry.captureException(error, { tags: { feature: "admin" }, extra: { action: input.action } });
		}
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "admin" }, extra: { action: input.action } });
	}
}
