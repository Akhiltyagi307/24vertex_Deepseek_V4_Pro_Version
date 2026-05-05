import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminGetUserById } from "@/lib/admin/users-list";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid user id");

		const row = await adminGetUserById(uuid.data);
		if (!row) return adminErrorResponse("Not found", { status: 404 });

		return adminDetailResponse(row);
	});
}
