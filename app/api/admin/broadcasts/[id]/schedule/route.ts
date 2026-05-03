import { eq } from "drizzle-orm";
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

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = z.object({ scheduled_at: z.string().datetime() }).safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "scheduled_at ISO datetime required" }, { status: 400, headers: adminHeaders() });
	}

	const when = new Date(parsed.data.scheduled_at);
	if (when.getTime() <= Date.now()) {
		return NextResponse.json({ error: "scheduled_at must be in the future" }, { status: 400, headers: adminHeaders() });
	}

	await writeAdminAction({ action: "broadcast_schedule", targetType: "broadcast", targetId: id, payload: { scheduled_at: when.toISOString() } });

	const [row] = await db
		.update(broadcasts)
		.set({ scheduledAt: when, status: "scheduled" })
		.where(eq(broadcasts.id, id))
		.returning();

	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

	return NextResponse.json({ data: row }, { headers: adminHeaders() });
}
