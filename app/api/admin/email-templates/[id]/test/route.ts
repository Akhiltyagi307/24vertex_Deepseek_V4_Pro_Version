import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";
import { compileMjmlToHtml } from "@/lib/email/mjml-compile";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

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
	const parsed = z.object({ variables: z.record(z.string(), z.string()).optional() }).safeParse(json);
	if (!parsed.success) return adminErrorResponse("Invalid body");
	const vars = parsed.data.variables ?? {
		student_name: "Test Student",
		teacher_name: "Test Teacher",
	};

	const to = process.env.ADMIN_EMAIL?.trim();
	if (!to) return adminErrorResponse("ADMIN_EMAIL not configured", { status: 500 });

	const subject = interpolate(row.subjectTmpl, vars);
	const { html } = await compileMjmlToHtml(row.bodyMjml);
	const bodyHtml = interpolate(html, vars);

	const { error } = await sendHtmlEmailLogged({
		to,
		subject: `[Test] ${subject}`,
		html: bodyHtml,
		templateSlug: row.slug,
		templateVariables: vars,
	});

	if (error) return adminErrorResponse(error, { status: 500 });

	// Strict audit: test-send dispatches mail through Resend; missing audit
	// row would leave us unable to explain a stray mail.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.EMAIL_TEMPLATE_TEST_SEND,
		targetType: "email_template",
		targetId: id,
	});

	return adminAckResponse();
}
