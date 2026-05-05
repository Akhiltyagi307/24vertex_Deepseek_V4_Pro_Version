import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { performComplianceErasure } from "@/lib/compliance/erasure";
import { eraseBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const uuid = z.string().uuid().safeParse(id);
	if (!uuid.success) return adminErrorResponse("Invalid id");

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = eraseBodySchema.safeParse(body);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}

	const idempotencyKey = request.headers.get("idempotency-key")?.trim() || parsed.data.idempotency_key || randomUUID();

	const [reqRow] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!reqRow) return adminErrorResponse("Not found", { status: 404 });
	if (reqRow.requestType !== "erasure") {
		return adminErrorResponse("Erasure only applies to erasure-type requests", { status: 409 });
	}
	if (!reqRow.identityVerified) {
		return adminErrorResponse("Identity must be verified before erasure", { status: 409 });
	}
	if (!reqRow.subjectUserId) {
		return adminErrorResponse("subject_user_id is required", { status: 409 });
	}
	if (reqRow.status === "fulfilled" && !parsed.data.dry_run) {
		return adminErrorResponse("Request already fulfilled", { status: 409 });
	}

	// TOTP is mandatory for any compliance erasure path — dry-run included.
	// The previous check tied enforcement to `isAdminTotpRequired()`, which
	// meant a deployment with the feature flag off (or `ADMIN_TOTP_SECRET`
	// unset) could process a DSR erasure with only a session cookie. That's
	// an irreversible operation on a real student's data and must always
	// have a second factor. Same hardening shape as the SQL writable
	// runner: refuse if the secret isn't configured, then verify.
	const totpSecretConfigured = Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
	if (!totpSecretConfigured) {
		return adminErrorResponse(
			"ADMIN_TOTP_SECRET must be configured before any compliance erasure can run",
			{ status: 403 },
		);
	}
	if (!parsed.data.totp?.trim() || !verifyAdminTotpIfConfigured(parsed.data.totp)) {
		return adminErrorResponse("Valid TOTP required", { status: 401 });
	}
	// `isAdminTotpRequired()` is preserved as an audit signal — telemetry
	// and the audit row should still record "TOTP enforced" vs "TOTP optional"
	// at the org-level for compliance reporting, even though we always
	// enforce here at the route level.
	const totpRequired = await isAdminTotpRequired();

	const subjectUserId = reqRow.subjectUserId;

	// Strict audit on the commit branch: erasure permanently deletes user
	// data and is the canonical destructive compliance action. Dry-run can
	// stay regular since it doesn't mutate.
	const auditCall = parsed.data.dry_run ? writeAdminAction : writeAdminActionStrict;
	await auditCall({
		action: parsed.data.dry_run ? ADMIN_ACTIONS.COMPLIANCE_ERASURE_DRY_RUN : ADMIN_ACTIONS.COMPLIANCE_ERASURE_COMMIT,
		targetType: "compliance_request",
		targetId: uuid.data,
		payload: { subject_user_id: subjectUserId, idempotency_key: idempotencyKey },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
		totpUsed: totpRequired,
	});

	const counts = await performComplianceErasure(subjectUserId, {
		dryRun: parsed.data.dry_run,
		complianceRequestId: uuid.data,
	});

	if (!parsed.data.dry_run) {
		await db
			.update(complianceRequests)
			.set({
				status: "fulfilled",
				fulfilledAt: new Date(),
				evidenceUrl: JSON.stringify({ type: "erasure", counts, idempotency_key: idempotencyKey }),
			})
			.where(eq(complianceRequests.id, uuid.data));
	}

	// Custom shape (dry_run flag + per-table counts) — keep client contract.
	return NextResponse.json(
		{ dry_run: parsed.data.dry_run, counts },
		{ headers: { ...ADMIN_RESPONSE_HEADERS } },
	);
}
