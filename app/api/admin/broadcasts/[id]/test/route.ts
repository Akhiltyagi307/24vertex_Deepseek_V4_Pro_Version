import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { broadcastBodyToEmailHtml } from "@/lib/admin/broadcast-markdown";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { broadcasts } from "@/db/schema/broadcasts";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
	if (!b) return adminErrorResponse("Not found", { status: 404 });

	const to = process.env.ADMIN_EMAIL?.trim();
	if (!to) return adminErrorResponse("ADMIN_EMAIL not configured", { status: 500 });

	const html = broadcastBodyToEmailHtml(b.bodyMd);
	const { error } = await sendHtmlEmailLogged({
		to,
		subject: `[Test] ${b.subject}`,
		html,
		templateSlug: "broadcast-test",
		broadcastId: id,
	});

	if (error) return adminErrorResponse(error, { status: 500 });

	// Strict audit: a test-send actually dispatches mail through Resend; an
	// admin send-mail action without an audit row is a compliance hole.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.BROADCAST_TEST_SEND,
		targetType: "broadcast",
		targetId: id,
	});

	return adminAckResponse();
}
