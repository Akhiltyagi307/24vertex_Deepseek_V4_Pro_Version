import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminListUsers, type AdminUserListRole } from "@/lib/admin/users-list";

export const runtime = "nodejs";

const roleSchema = z.enum(["student", "parent", "teacher"]);

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const roleParsed = roleSchema.safeParse(sp.get("role"));
		if (!roleParsed.success) {
			return NextResponse.json({ error: "role must be student|parent|teacher" }, { status: 400, headers: adminHeaders() });
		}
		const role = roleParsed.data as AdminUserListRole;

		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(250, Math.max(1, Number(sp.get("page_size") ?? "25") || 25));
		const gradeRaw = sp.get("grade");
		const grade = gradeRaw != null && gradeRaw !== "" ? Number(gradeRaw) : null;
		const section = sp.get("section");
		const stream = sp.get("stream");
		const q = sp.get("q");
		const sort = sp.get("sort");
		const include_deleted = sp.get("include_deleted") === "1";
		const include_suspended = sp.get("include_suspended") === "1";

		const { rows, total } = await adminListUsers({
			role,
			page,
			pageSize,
			q,
			grade: Number.isFinite(grade) ? grade : null,
			section,
			stream,
			includeDeleted: include_deleted,
			includeSuspended: include_suspended,
			sort,
		});

		return NextResponse.json({ data: rows, total, page, page_size: pageSize }, { headers: adminHeaders() });
	});
}
