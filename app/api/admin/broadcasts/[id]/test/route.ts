import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { broadcastBodyToEmailHtml } from "@/lib/admin/broadcast-markdown";
import { db } from "@/db";
import { broadcasts } from "@/db/schema/broadcasts";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
	if (!b) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

	const to = process.env.ADMIN_EMAIL?.trim();
	if (!to) {
		return NextResponse.json({ error: "ADMIN_EMAIL not configured" }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({ action: "broadcast_test_send", targetType: "broadcast", targetId: id });

	const html = broadcastBodyToEmailHtml(b.bodyMd);
	const { error } = await sendHtmlEmailLogged({
		to,
		subject: `[Test] ${b.subject}`,
		html,
		templateSlug: "broadcast-test",
		broadcastId: id,
	});

	if (error) {
		return NextResponse.json({ error }, { status: 500, headers: adminHeaders() });
	}
	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
