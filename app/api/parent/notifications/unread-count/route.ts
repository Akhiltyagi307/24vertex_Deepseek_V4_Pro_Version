import { NextResponse } from "next/server";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getStudentUnreadCount } from "@/lib/notifications/student-queries";
import { consumeParentNotifRead } from "@/lib/parent/rate-limit";
import { rateLimitedResponse } from "@/lib/ratelimit/headers";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
}

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
		return rateLimitedResponse(rl.result, rl.limit, { code: "parent_notif_rate_limited" });
	}

	const supabase = await createClient();
	try {
		const count = await getStudentUnreadCount(supabase, user.id);
		return NextResponse.json({ count }, { headers: privateHeaders() });
	} catch (err) {
		logSupabaseError("parent.notifications.unread_count", err as { message?: string }, {
			userId: user.id,
		});
		return NextResponse.json(
			{ error: "Could not load unread count." },
			{ status: 500, headers: privateHeaders() },
		);
	}
}
