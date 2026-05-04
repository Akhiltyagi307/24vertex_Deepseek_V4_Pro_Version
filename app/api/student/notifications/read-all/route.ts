import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
}

/**
 * POST /api/student/notifications/read-all
 *
 * Marks all of the signed-in student's unread notifications as read.
 */
export async function POST() {
	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders() });
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
