import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import {
	STUDENT_NOTIFICATIONS_LIMIT_N,
	STUDENT_NOTIFICATIONS_WINDOW_SECONDS,
	consumeStudentRateLimit,
} from "@/lib/student/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
	.object({
		is_read: z.boolean(),
	})
	.strict();

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
 * PATCH /api/student/notifications/:id
 *
 * Marks a single notification read or unread for the signed-in student.
 * RLS on `notifications` ensures the update only applies to their own rows.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders() });
	}

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "notif-patch",
		limitN: STUDENT_NOTIFICATIONS_LIMIT_N,
		windowSeconds: STUDENT_NOTIFICATIONS_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		return rateLimitedResponse(rl.resetAt);
	}

	const { id } = await ctx.params;
	if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: privateHeaders() });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: privateHeaders() });
	}
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: privateHeaders() });
	}

	const supabase = await createClient();
	const { error } = await supabase
		.from("notifications")
		.update({
			is_read: parsed.data.is_read,
			read_at: parsed.data.is_read ? new Date().toISOString() : null,
		})
		.eq("id", id)
		.eq("recipient_id", user.id);

	if (error) {
		logSupabaseError("student.notifications.patch", error, { userId: user.id, id });
		return NextResponse.json(
			{ error: "Could not update notification." },
			{ status: 500, headers: privateHeaders() },
		);
	}

	return NextResponse.json({ ok: true }, { headers: privateHeaders() });
}
