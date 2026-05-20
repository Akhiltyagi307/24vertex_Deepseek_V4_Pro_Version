import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { getStudentActivityStreakSnapshot } from "@/lib/student/activity-streak";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import {
	STUDENT_NOTIFICATIONS_LIMIT_N,
	STUDENT_NOTIFICATIONS_WINDOW_SECONDS,
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

/** GET /api/student/activity-streak — weekly practice streak for the top-bar widget. */
export async function GET() {
	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders() });
	}

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "activity-streak",
		limitN: STUDENT_NOTIFICATIONS_LIMIT_N,
		windowSeconds: STUDENT_NOTIFICATIONS_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		return rateLimitedResponse(rl.resetAt);
	}

	const supabase = await createClient();
	try {
		const snapshot = await getStudentActivityStreakSnapshot(supabase, user.id);
		return NextResponse.json(snapshot, { headers: privateHeaders() });
	} catch (err) {
		logSupabaseError("student.activity_streak", err as { message?: string }, { userId: user.id });
		return NextResponse.json(
			{ error: "Could not load activity streak." },
			{ status: 500, headers: privateHeaders() },
		);
	}
}
