import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { adminListTests } from "@/lib/admin/tests-admin";
import { requireAdminApi } from "@/lib/admin/api-auth";
export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size") ?? "25") || 25));
		const status = sp.get("status");
		const q = sp.get("q");

		const { rows, total } = await adminListTests({ page, pageSize, status, q });

		return NextResponse.json({ data: rows, total, page, page_size: pageSize }, { headers: adminHeaders() });
	});
}
