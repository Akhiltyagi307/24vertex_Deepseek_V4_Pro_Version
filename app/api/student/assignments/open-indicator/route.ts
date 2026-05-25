import { NextResponse } from "next/server";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { hasOpenAssignmentsForStudent } from "@/lib/assignments/has-open-assignments";
import { parseStrictEmptyQuery } from "@/lib/student/api-query-schemas";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import {
	STUDENT_ASSIGNMENT_INDICATOR_LIMIT_N,
	STUDENT_ASSIGNMENT_INDICATOR_WINDOW_SECONDS,
	consumeStudentRateLimit,
} from "@/lib/student/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateHeaders(extra?: Record<string, string>): HeadersInit {
	return {
		"X-Robots-Tag": "noindex, nofollow",
		"Cache-Control": "no-store",
		...extra,
	};
}

function rateLimitedResponse(resetAt: Date): NextResponse {
	const retryAfterSec = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
	return NextResponse.json(
		{ error: "Too many requests. Try again shortly." },
		{
			status: 429,
			headers: privateHeaders({ "Retry-After": String(retryAfterSec) }),
		},
	);
}

/**
 * GET /api/student/assignments/open-indicator
 *
 * Whether the signed-in student has open (not yet submitted) assignments.
 */
export async function GET(request: Request) {
	const query = parseStrictEmptyQuery(new URL(request.url).searchParams);
	if (!query.ok) {
		return NextResponse.json(
			{ error: query.error },
			{ status: 400, headers: privateHeaders() },
		);
	}

	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders() });
	}

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "student") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders() });
	}

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "assignments-open-indicator",
		limitN: STUDENT_ASSIGNMENT_INDICATOR_LIMIT_N,
		windowSeconds: STUDENT_ASSIGNMENT_INDICATOR_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		return rateLimitedResponse(rl.resetAt);
	}

	try {
		const hasOpen = await hasOpenAssignmentsForStudent(user.id);
		return NextResponse.json({ hasOpen }, { headers: privateHeaders() });
	} catch (err) {
		logSupabaseError("student.assignments.open_indicator", err as { message?: string }, {
			userId: user.id,
		});
		return NextResponse.json(
			{ error: "Could not load assignment status." },
			{ status: 500, headers: privateHeaders() },
		);
	}
}
