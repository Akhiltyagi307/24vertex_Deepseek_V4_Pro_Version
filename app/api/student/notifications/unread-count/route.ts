import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { getStudentUnreadCount } from "@/lib/notifications/student-queries";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
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
