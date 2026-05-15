import "server-only";

import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/comms-audit";
import { clientIpForPostgresInet } from "@/lib/admin/ip-sanitize";
import { logServerError } from "@/lib/server/log-supabase-error";

import type { OrganizationAccessActionName } from "./audit-actions";

export type OrganizationAccessAuditInput = {
	action: OrganizationAccessActionName | string;
	actorId: string;
	entityType?: string | null;
	entityId?: string | null;
	changes?: Record<string, unknown> | null;
	ipAddress?: string | null;
};

export async function writeOrganizationAccessAudit(
	input: OrganizationAccessAuditInput,
): Promise<boolean> {
	try {
		await db.insert(auditLogs).values({
			userId: input.actorId,
			action: input.action,
			entityType: input.entityType ?? null,
			entityId: input.entityId ?? null,
			changes: input.changes ?? null,
			ipAddress: clientIpForPostgresInet(input.ipAddress),
		});
		return true;
	} catch (err) {
		logServerError("organizations.audit.write", err, {
			action: input.action,
			actorId: input.actorId,
			entityType: input.entityType ?? "",
		});
		Sentry.captureMessage("organization_access_audit_failed", {
			level: "warning",
			tags: { feature: "organizations", phase: "audit" },
			extra: { action: input.action, actor_id: input.actorId },
		});
		return false;
	}
}
