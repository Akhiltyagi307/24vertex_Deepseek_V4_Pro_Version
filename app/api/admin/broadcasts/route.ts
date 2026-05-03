import { count, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { broadcasts } from "@/db/schema/broadcasts";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const audienceSchema = z.object({
	kind: z.enum(["all", "students", "parents", "teachers", "grade", "plan"]),
	grade: z.number().optional(),
	section: z.string().optional(),
	stream: z.string().optional(),
	plan_code: z.string().optional(),
});

const channelsSchema = z.object({
	in_app: z.boolean().default(true),
	email: z.boolean().default(false),
	priority_urgent: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
	const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("page_size") ?? "25") || 25));
	const offset = (page - 1) * pageSize;

	const rows = await db
		.select()
		.from(broadcasts)
		.orderBy(desc(broadcasts.createdAt))
		.limit(pageSize)
		.offset(offset);

	const [cntRow] = await db.select({ c: count() }).from(broadcasts);
	const total = Number(cntRow?.c ?? 0);

	return NextResponse.json({ data: rows, total, page, page_size: pageSize }, { headers: adminHeaders() });
}

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const bodySchema = z.object({
		subject: z.string().min(1).max(500),
		body_md: z.string().min(1),
		audience: audienceSchema,
		channels: channelsSchema.optional(),
	});
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "broadcast_create",
		payload: { subject: parsed.data.subject },
	});

	const ch = parsed.data.channels ?? { in_app: true, email: false, priority_urgent: false };
	const [row] = await db
		.insert(broadcasts)
		.values({
			subject: parsed.data.subject,
			bodyMd: parsed.data.body_md,
			audienceJson: parsed.data.audience,
			channelsJson: ch,
			status: "draft",
		})
		.returning();

	return NextResponse.json({ data: row }, { headers: adminHeaders() });
}
