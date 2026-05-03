import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";
import { compileMjmlToHtml } from "@/lib/email/mjml-compile";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

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
	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		json = {};
	}
	const parsed = z.object({ variables: z.record(z.string(), z.string()).optional() }).safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: adminHeaders() });
	}
	const vars = parsed.data.variables ?? {
		student_name: "Test Student",
		teacher_name: "Test Teacher",
	};

	const to = process.env.ADMIN_EMAIL?.trim();
	if (!to) {
		return NextResponse.json({ error: "ADMIN_EMAIL not configured" }, { status: 500, headers: adminHeaders() });
	}

	const subject = interpolate(row.subjectTmpl, vars);
	const { html } = compileMjmlToHtml(row.bodyMjml);
	const bodyHtml = interpolate(html, vars);

	await writeAdminAction({ action: "email_template_test_send", targetType: "email_template", targetId: id });

	const { error } = await sendHtmlEmailLogged({
		to,
		subject: `[Test] ${subject}`,
		html: bodyHtml,
		templateSlug: row.slug,
		templateVariables: vars,
	});

	if (error) {
		return NextResponse.json({ error }, { status: 500, headers: adminHeaders() });
	}
	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
