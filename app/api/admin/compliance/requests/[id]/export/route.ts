import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { recordComplianceEvent } from "@/lib/compliance/events";
import { buildComplianceExportZip } from "@/lib/compliance/export-user-data";
import { getComplianceExportsBucket } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const uuid = z.string().uuid().safeParse(id);
	if (!uuid.success) return adminErrorResponse("Invalid id");

	const [reqRow] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, uuid.data)).limit(1);
	if (!reqRow) return adminErrorResponse("Not found", { status: 404 });
	if (!reqRow.identityVerified) {
		return adminErrorResponse("Identity must be verified before export", { status: 409 });
	}
	if (!reqRow.subjectUserId) {
		return adminErrorResponse("subject_user_id is required for export", { status: 409 });
	}

	const subjectUserId = reqRow.subjectUserId;

	await writeAdminAction({
		action: ADMIN_ACTIONS.COMPLIANCE_EXPORT_STARTED,
		targetType: "compliance_request",
		targetId: uuid.data,
		payload: { subject_user_id: subjectUserId },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});
	await recordComplianceEvent({
		requestId: uuid.data,
		phase: "build",
		status: "started",
		payload: { subject_user_id: subjectUserId },
	});

	let buffer: Buffer;
	let manifest: Awaited<ReturnType<typeof buildComplianceExportZip>>["manifest"];
	try {
		const built = await buildComplianceExportZip({
			subjectUserId: subjectUserId,
			complianceRequestId: uuid.data,
		});
		buffer = built.buffer;
		manifest = built.manifest;
	} catch (e) {
		const errMessage = e instanceof Error ? e.message : String(e);
		await recordComplianceEvent({
			requestId: uuid.data,
			phase: "build",
			status: "failed",
			errorMessage: errMessage,
		});
		throw e;
	}
	await recordComplianceEvent({
		requestId: uuid.data,
		phase: "build",
		status: "ok",
		payload: { manifest },
	});

	const bucket = getComplianceExportsBucket();
	const storagePath = `dsr/${uuid.data}/${Date.now()}.zip`;
	const admin = createServiceRoleClient();
	await recordComplianceEvent({
		requestId: uuid.data,
		phase: "upload",
		status: "started",
		payload: { storage_path: storagePath },
	});
	const { error: upErr } = await admin.storage.from(bucket).upload(storagePath, buffer, {
		contentType: "application/zip",
		upsert: false,
	});
	if (upErr) {
		await writeAdminAction({
			action: ADMIN_ACTIONS.COMPLIANCE_EXPORT_FAILED,
			targetType: "compliance_request",
			targetId: uuid.data,
			payload: { error: upErr.message, storage_path: storagePath },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});
		await recordComplianceEvent({
			requestId: uuid.data,
			phase: "upload",
			status: "failed",
			errorMessage: upErr.message,
			payload: { storage_path: storagePath },
		});
		return adminErrorResponse(upErr.message, { status: 500 });
	}

	const signedTtl = 60 * 60 * 24 * 7;
	const { data: signed, error: signErr } = await admin.storage.from(bucket).createSignedUrl(storagePath, signedTtl);
	if (signErr || !signed?.signedUrl) {
		await recordComplianceEvent({
			requestId: uuid.data,
			phase: "upload",
			status: "failed",
			errorMessage: signErr?.message ?? "Could not sign URL",
			payload: { storage_path: storagePath },
		});
		return adminErrorResponse(signErr?.message ?? "Could not sign URL", { status: 500 });
	}

	// Strict audit: the upload + signed-URL succeeded — this is the
	// "export ready" compliance evidence row. Missing audit row would leave
	// a downloadable evidence package without a trail of who issued it.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.COMPLIANCE_EXPORT_READY,
		targetType: "compliance_request",
		targetId: uuid.data,
		payload: { storage_path: storagePath, manifest, signed_ttl_seconds: signedTtl },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});
	await recordComplianceEvent({
		requestId: uuid.data,
		phase: "upload",
		status: "ok",
		payload: { storage_path: storagePath, manifest, signed_ttl_seconds: signedTtl },
	});

	await db
		.update(complianceRequests)
		.set({
			evidenceUrl: JSON.stringify({ type: "export", storage_path: storagePath, manifest }),
			status: reqRow.status === "open" ? "in_progress" : reqRow.status,
		})
		.where(eq(complianceRequests.id, uuid.data));

	// Custom shape — preserves the client contract for the export payload.
	return NextResponse.json(
		{ signed_url: signed.signedUrl, storage_path: storagePath, manifest, expires_in_seconds: signedTtl },
		{ headers: { ...ADMIN_RESPONSE_HEADERS } },
	);
}
