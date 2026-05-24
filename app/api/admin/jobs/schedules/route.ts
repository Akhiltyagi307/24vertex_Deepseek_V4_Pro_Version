import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { getAdminJobSchedules } from "@/lib/admin/jobs/schedules";
import { adminDetailResponse } from "@/lib/admin/response";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		return adminDetailResponse(getAdminJobSchedules());
	});
}
