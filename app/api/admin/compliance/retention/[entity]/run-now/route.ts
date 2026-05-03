import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { purgeRetentionEntity } from "@/lib/compliance/retention-purge";
import { retentionRunNowBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { retentionPolicies } from "@/db/schema/retention-policies";

export const runtime = "nodejs";
export const maxDuration = 120;

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { entity: rawEntity } = await ctx.params;
	const entity = decodeURIComponent(rawEntity).slice(0, 100);
	if (!entity) {
		return NextResponse.json({ error: "Invalid entity" }, { status: 400, headers: adminHeaders() });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const parsed = retentionRunNowBodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}

	const dryRun = parsed.data.dry_run ?? true;
	const commit = parsed.data.commit === true;

	if (!dryRun && !commit) {
		return NextResponse.json({ error: "Set commit: true to run a destructive purge" }, { status: 400, headers: adminHeaders() });
	}

	if (!dryRun) {
		const totpRequired = await isAdminTotpRequired();
		if (totpRequired && !verifyAdminTotpIfConfigured(parsed.data.totp)) {
			return NextResponse.json({ error: "TOTP required for commit" }, { status: 401, headers: adminHeaders() });
		}
	}

	const [pol] = await db.select().from(retentionPolicies).where(eq(retentionPolicies.entity, entity)).limit(1);
	if (!pol) {
		return NextResponse.json({ error: "Unknown entity" }, { status: 404, headers: adminHeaders() });
	}
	if (!pol.enabled && !dryRun) {
		return NextResponse.json({ error: "Enable policy before commit run" }, { status: 409, headers: adminHeaders() });
	}

	const n = await purgeRetentionEntity(entity, pol.ttlDays, dryRun);

	await writeAdminAction({
		action: dryRun ? "retention_purge_dry_run" : "retention_purge_commit",
		targetType: "retention_policy",
		targetId: entity,
		payload: { deleted_or_would_delete: n, ttl_days: pol.ttlDays },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ entity, dry_run: dryRun, deleted_or_would_delete: n }, { headers: adminHeaders() });
}
