import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminSubjectCreateSchema } from "@/lib/admin/schemas/subject";
import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db.select().from(subjects).where(eq(subjects.id, uuid.data)).limit(1);
		if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		return NextResponse.json({ data: rows[0] }, { headers: adminHeaders() });
	});
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		const existing = await db.select().from(subjects).where(eq(subjects.id, uuid.data)).limit(1);
		const cur = existing[0];
		if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const merged = {
			name: (body as { name?: string }).name ?? cur.name,
			grade: (body as { grade?: number }).grade ?? cur.grade,
			subject_group: (body as { subject_group?: string | null }).subject_group ?? cur.subjectGroup,
			stream: (body as { stream?: string | null }).stream ?? cur.stream,
			is_elective: (body as { is_elective?: boolean }).is_elective ?? cur.isElective ?? false,
			sort_order: (body as { sort_order?: number }).sort_order ?? cur.sortOrder,
		};
		const parsed = adminSubjectCreateSchema.safeParse(merged);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}
		const b = parsed.data;

		await db
			.update(subjects)
			.set({
				name: b.name,
				grade: b.grade,
				subjectGroup: b.subject_group ?? null,
				stream: b.stream ?? null,
				isElective: b.is_elective ?? false,
				sortOrder: b.sort_order ?? 0,
				updatedAt: new Date(),
			})
			.where(eq(subjects.id, uuid.data));

		await writeAdminAction({
			action: "subject_update",
			targetType: "subject",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		await db
			.update(subjects)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(subjects.id, uuid.data));

		await writeAdminAction({
			action: "subject_soft_delete",
			targetType: "subject",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
