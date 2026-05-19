import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { getStudentUnreadCount } from "@/lib/notifications/student-queries";
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
 * GET /api/student/notifications/unread-count
 *
 * Lightweight count endpoint used by the top-bar bell when Realtime is
 * unavailable (60s poll fallback) and for initial hydration.
 */
export async function GET() {
	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders() });
	}

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "notif-unread-count",
		limitN: STUDENT_NOTIFICATIONS_LIMIT_N,
		windowSeconds: STUDENT_NOTIFICATIONS_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		return rateLimitedResponse(rl.resetAt);
	}

	const supabase = await createClient();
	try {
		const count = await getStudentUnreadCount(supabase, user.id);
		return NextResponse.json({ count }, { headers: privateHeaders() });
	} catch (err) {
		logSupabaseError("student.notifications.unread_count", err as { message?: string }, {
			userId: user.id,
		});
		return NextResponse.json(
			{ error: "Could not load unread count." },
			{ status: 500, headers: privateHeaders() },
		);
	}
}
