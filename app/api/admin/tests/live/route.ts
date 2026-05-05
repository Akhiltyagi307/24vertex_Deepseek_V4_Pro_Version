import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse } from "@/lib/admin/response";
import { adminListLiveTests } from "@/lib/admin/tests-admin";

export const runtime = "nodejs";

export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const rows = await adminListLiveTests();
	return adminDetailResponse(rows);
}
