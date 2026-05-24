import { NextResponse } from "next/server";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { hasOpenAssignmentsForStudent } from "@/lib/assignments/has-open-assignments";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { consumeParentNotifRead } from "@/lib/parent/rate-limit";
import { rateLimitedResponse } from "@/lib/ratelimit/headers";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
}

/**
 * GET /api/parent/assignments/open-indicator
 *
 * Whether the active linked child has open (not yet submitted) assignments.
 */
export async function GET() {
	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders() });
	}

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "parent") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders() });
	}

	const rl = await consumeParentNotifRead(user.id);
	if (!rl.ok) {
		return rateLimitedResponse(rl.result, rl.limit, { code: "parent_assignments_indicator_rate_limited" });
	}

	const activeStudentId = await getParentActiveStudentIdFromCookie();
	if (!activeStudentId) {
		return NextResponse.json({ hasOpen: false }, { headers: privateHeaders() });
	}

	const linked = await assertParentActiveLink(user.id, activeStudentId);
	if (!linked) {
		return NextResponse.json({ hasOpen: false }, { headers: privateHeaders() });
	}

	try {
		const hasOpen = await hasOpenAssignmentsForStudent(activeStudentId);
		return NextResponse.json({ hasOpen }, { headers: privateHeaders() });
	} catch (err) {
		logSupabaseError("parent.assignments.open_indicator", err as { message?: string }, {
			parentUserId: user.id,
			studentId: activeStudentId,
		});
		return NextResponse.json(
			{ error: "Could not load assignment status." },
			{ status: 500, headers: privateHeaders() },
		);
	}
}
