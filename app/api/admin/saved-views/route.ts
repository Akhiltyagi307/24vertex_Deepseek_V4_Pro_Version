import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { adminSavedViews } from "@/db/schema/admin-saved-views";

export const runtime = "nodejs";

const postSchema = z.object({
	list_id: z.string().min(1).max(120),
	name: z.string().min(1).max(200),
	state: z.record(z.unknown()).default({}),
});

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const listId = request.nextUrl.searchParams.get("list_id")?.trim();
		if (!listId) {
			return NextResponse.json({ error: "list_id required" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db
			.select({
				id: adminSavedViews.id,
				name: adminSavedViews.name,
				state: adminSavedViews.state,
			})
			.from(adminSavedViews)
			.where(eq(adminSavedViews.listId, listId))
			.orderBy(asc(adminSavedViews.name));

		return NextResponse.json({ data: rows }, { headers: adminHeaders() });
	});
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = postSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const { list_id, name, state } = parsed.data;

		const existing = await db
			.select({ id: adminSavedViews.id })
			.from(adminSavedViews)
			.where(and(eq(adminSavedViews.listId, list_id), eq(adminSavedViews.name, name)))
			.limit(1);

		if (existing[0]) {
			await db
				.update(adminSavedViews)
				.set({ state: state as object, updatedAt: new Date() })
				.where(eq(adminSavedViews.id, existing[0].id));
			return NextResponse.json({ ok: true, id: existing[0].id, updated: true }, { headers: adminHeaders() });
		}

		const inserted = await db
			.insert(adminSavedViews)
			.values({
				listId: list_id,
				name,
				state: state as object,
			})
			.returning({ id: adminSavedViews.id });

		return NextResponse.json({ ok: true, id: inserted[0]?.id, updated: false }, { status: 201, headers: adminHeaders() });
	});
}
