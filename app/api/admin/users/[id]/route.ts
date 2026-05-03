import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminGetUserById } from "@/lib/admin/users-list";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid user id" }, { status: 400, headers: adminHeaders() });
		}

		const row = await adminGetUserById(uuid.data);
		if (!row) {
			return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		}

		return NextResponse.json({ data: row }, { headers: adminHeaders() });
	});
}
