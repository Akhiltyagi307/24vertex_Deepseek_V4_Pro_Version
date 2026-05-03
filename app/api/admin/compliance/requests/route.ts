import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { captureOpenComplianceDeadlineRisk } from "@/lib/compliance/alerts";
import { complianceDueAtFromLegalBasis } from "@/lib/compliance/due-at";
import { createComplianceRequestBodySchema } from "@/lib/compliance/schemas";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const sp = request.nextUrl.searchParams;
	const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
	const pageSize = Math.min(200, Math.max(1, Number(sp.get("page_size") ?? "25") || 25));
	const offset = (page - 1) * pageSize;
	const status = sp.get("status");
	const requestType = sp.get("request_type");
	const q = sp.get("q");
	const from = sp.get("from");
	const to = sp.get("to");

	const conditions = [];
	if (status) conditions.push(eq(complianceRequests.status, status));
	if (requestType) conditions.push(eq(complianceRequests.requestType, requestType));
	if (q?.trim()) {
		const p = `%${q.trim().replace(/%/g, "\\%")}%`;
		conditions.push(
			or(
				ilike(complianceRequests.requesterEmail, p),
				ilike(complianceRequests.subjectEmail, p),
				ilike(complianceRequests.notes, p),
			)!,
		);
	}
	if (from) {
		const d = new Date(from);
		if (!Number.isNaN(d.getTime())) conditions.push(gte(complianceRequests.createdAt, d));
	}
	if (to) {
		const d = new Date(to);
		if (!Number.isNaN(d.getTime())) conditions.push(lte(complianceRequests.createdAt, d));
	}
	const whereSql = conditions.length ? and(...conditions) : undefined;

	const data = await db
		.select()
		.from(complianceRequests)
		.where(whereSql)
		.orderBy(desc(complianceRequests.createdAt))
		.limit(pageSize)
		.offset(offset);

	const [cntRow] = await db.select({ c: count() }).from(complianceRequests).where(whereSql);
	const total = Number(cntRow?.c ?? 0);

	void captureOpenComplianceDeadlineRisk();

	return NextResponse.json({ data, total, page, page_size: pageSize }, { headers: adminHeaders() });
}

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = createComplianceRequestBodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}

	const b = parsed.data;
	if (!b.subject_user_id && !b.subject_email?.trim()) {
		return NextResponse.json(
			{ error: "Provide subject_user_id and/or subject_email" },
			{ status: 400, headers: adminHeaders() },
		);
	}

	const now = new Date();
	const dueAt = complianceDueAtFromLegalBasis(b.legal_basis, now);

	const [row] = await db
		.insert(complianceRequests)
		.values({
			requestType: b.request_type,
			subjectUserId: b.subject_user_id ?? null,
			subjectEmail: b.subject_email?.trim() ?? null,
			requesterEmail: b.requester_email.trim(),
			requesterRelation: b.requester_relation,
			legalBasis: b.legal_basis,
			notes: b.notes?.trim() ?? null,
			dueAt,
		})
		.returning();

	await writeAdminAction({
		action: "compliance_request_created",
		targetType: "compliance_request",
		targetId: row?.id ?? null,
		payload: {
			request_type: b.request_type,
			legal_basis: b.legal_basis,
			subject_user_id: b.subject_user_id ?? null,
		},
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ data: row }, { status: 201, headers: adminHeaders() });
}
