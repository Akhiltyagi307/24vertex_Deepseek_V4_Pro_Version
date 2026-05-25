import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { parseStrictEmptyQuery } from "@/lib/student/api-query-schemas";
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

/**
 * POST /api/student/notifications/read-all
 *
 * Marks all of the signed-in student's unread notifications as read.
 */
export async function POST(request: Request) {
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

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "notif-read-all",
		limitN: STUDENT_NOTIFICATIONS_LIMIT_N,
		windowSeconds: STUDENT_NOTIFICATIONS_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		return rateLimitedResponse(rl.resetAt);
	}

	const supabase = await createClient();
	const { error } = await supabase
		.from("notifications")
		.update({ is_read: true, read_at: new Date().toISOString() })
		.eq("recipient_id", user.id)
		.eq("is_read", false);

	if (error) {
		logSupabaseError("student.notifications.read_all", error, { userId: user.id });
		return NextResponse.json(
			{ error: "Could not mark notifications as read." },
			{ status: 500, headers: privateHeaders() },
		);
	}
	return NextResponse.json({ ok: true }, { headers: privateHeaders() });
}
