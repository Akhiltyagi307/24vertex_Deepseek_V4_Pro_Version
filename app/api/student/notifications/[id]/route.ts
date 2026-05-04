import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
	is_read: z.boolean(),
});

function privateHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
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
