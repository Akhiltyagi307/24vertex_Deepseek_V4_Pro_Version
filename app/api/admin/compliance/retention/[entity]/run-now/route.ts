import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { purgeRetentionEntity } from "@/lib/compliance/retention-purge";
import { retentionRunNowBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { retentionPolicies } from "@/db/schema/retention-policies";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { entity: rawEntity } = await ctx.params;
	const entity = decodeURIComponent(rawEntity).slice(0, 100);
	if (!entity) return adminErrorResponse("Invalid entity");

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const parsed = retentionRunNowBodySchema.safeParse(body);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}

	const dryRun = parsed.data.dry_run ?? true;
	const commit = parsed.data.commit === true;

	if (!dryRun && !commit) {
		return adminErrorResponse("Set commit: true to run a destructive purge");
	}

	if (!dryRun) {
		const totpRequired = await isAdminTotpRequired();
		if (totpRequired && !verifyAdminTotpIfConfigured(parsed.data.totp)) {
			return adminErrorResponse("TOTP required for commit", { status: 401 });
		}
	}

	const [pol] = await db.select().from(retentionPolicies).where(eq(retentionPolicies.entity, entity)).limit(1);
	if (!pol) return adminErrorResponse("Unknown entity", { status: 404 });
	if (!pol.enabled && !dryRun) {
		return adminErrorResponse("Enable policy before commit run", { status: 409 });
	}

	const n = await purgeRetentionEntity(entity, pol.ttlDays, dryRun);

	// Strict audit on commit: a real purge has now run and rows are deleted.
	// Dry-run stays regular (no mutation occurred).
	const auditCall = dryRun ? writeAdminAction : writeAdminActionStrict;
	await auditCall({
		action: dryRun ? ADMIN_ACTIONS.RETENTION_PURGE_DRY_RUN : ADMIN_ACTIONS.RETENTION_PURGE_COMMIT,
		targetType: "retention_policy",
		targetId: entity,
		payload: { deleted_or_would_delete: n, ttl_days: pol.ttlDays },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	// Custom shape (entity + dry_run + count) — preserve client contract.
	return NextResponse.json(
		{ entity, dry_run: dryRun, deleted_or_would_delete: n },
		{ headers: { ...ADMIN_RESPONSE_HEADERS } },
	);
}
