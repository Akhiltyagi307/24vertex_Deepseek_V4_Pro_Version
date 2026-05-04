import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { listStudentNotifications, getStudentUnreadCount } from "@/lib/notifications/student-queries";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
}

/**
 * GET /api/student/notifications?cursor=<iso>&filter=all|unread&limit=20
 *
 * Returns the signed-in student's notifications ordered by `created_at DESC`.
 * Enforcement comes from the RLS policy on `public.notifications`
 * (`auth.uid() = recipient_id`); this handler just prevents anonymous access.
 */
export async function GET(request: Request) {
	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders() });
	}

	const url = new URL(request.url);
	const cursor = url.searchParams.get("cursor");
	const filterRaw = url.searchParams.get("filter");
	const limitRaw = url.searchParams.get("limit");
	const filter = filterRaw === "unread" ? "unread" : "all";
	const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

	const supabase = await createClient();
	try {
		const [page, unreadCount] = await Promise.all([
			listStudentNotifications(supabase, {
				userId: user.id,
				cursor: cursor ?? undefined,
				limit: Number.isFinite(limit) && (limit as number) > 0 ? limit : undefined,
				filter,
			}),
			getStudentUnreadCount(supabase, user.id),
		]);
		return NextResponse.json(
			{ items: page.items, nextCursor: page.nextCursor, unreadCount },
			{ headers: privateHeaders() },
		);
	} catch (err) {
		logSupabaseError("student.notifications.list", err as { message?: string }, {
			userId: user.id,
		});
		return NextResponse.json(
			{ error: "Could not load notifications." },
			{ status: 500, headers: privateHeaders() },
		);
	}
}
