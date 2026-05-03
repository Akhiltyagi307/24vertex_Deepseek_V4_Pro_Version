import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "email_template_activate",
		targetType: "email_template",
		targetId: id,
		payload: { slug: row.slug, version: row.version },
	});

	await db.transaction(async (tx) => {
		await tx.update(emailTemplates).set({ isActive: false }).where(eq(emailTemplates.slug, row.slug));
		await tx.update(emailTemplates).set({ isActive: true }).where(eq(emailTemplates.id, id));
	});

	const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
	return NextResponse.json({ data: updated }, { headers: adminHeaders() });
}
