import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
	if (!row) return adminErrorResponse("Not found", { status: 404 });

	await writeAdminAction({
		action: ADMIN_ACTIONS.EMAIL_TEMPLATE_ACTIVATE,
		targetType: "email_template",
		targetId: id,
		payload: { slug: row.slug, version: row.version },
	});

	await db.transaction(async (tx) => {
		await tx.update(emailTemplates).set({ isActive: false }).where(eq(emailTemplates.slug, row.slug));
		await tx.update(emailTemplates).set({ isActive: true }).where(eq(emailTemplates.id, id));
	});

	const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
	return adminDetailResponse(updated);
}
