import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse } from "@/lib/admin/response";
import { adminListPendingTeachers } from "@/lib/admin/teachers-pending-list";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const data = await adminListPendingTeachers();
		return adminDetailResponse(data);
	});
}
