import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";
import { compileMjmlToHtml } from "@/lib/email/mjml-compile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function interpolate(tmpl: string, vars: Record<string, string>): string {
	let out = tmpl;
	for (const [k, v] of Object.entries(vars)) {
		out = out.split(`{{${k}}}`).join(v);
	}
	return out;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
	if (!row) return adminErrorResponse("Not found", { status: 404 });

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		json = {};
	}
	const parsed = z.object({ variables: z.record(z.string(), z.string()).optional() }).strict().safeParse(json);
	if (!parsed.success) return adminErrorResponse("Invalid body");
	const vars = parsed.data.variables ?? {};

	const subject = interpolate(row.subjectTmpl, vars);
	const { html, errors } = await compileMjmlToHtml(row.bodyMjml);
	const bodyHtml = interpolate(html, vars);

	// Custom shape (subject + html + mjml_errors) — keep the client contract.
	return NextResponse.json(
		{ subject, html: bodyHtml, mjml_errors: errors },
		{ headers: { ...ADMIN_RESPONSE_HEADERS } },
	);
}
