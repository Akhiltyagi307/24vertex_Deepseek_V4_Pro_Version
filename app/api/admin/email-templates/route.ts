import { desc, eq, max } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_RESPONSE_HEADERS, adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";
import { compileMjmlToHtml } from "@/lib/email/mjml-compile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const slug = request.nextUrl.searchParams.get("slug");
	const rows = slug
		? await db.select().from(emailTemplates).where(eq(emailTemplates.slug, slug)).orderBy(desc(emailTemplates.version))
		: await db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt)).limit(500);

	return adminDetailResponse(rows);
}

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const schema = z.object({
		slug: z.string().min(1).max(100),
		subject_tmpl: z.string().min(1),
		body_mjml: z.string().min(1),
		variables: z.record(z.string(), z.any()).optional(),
		notes: z.string().optional(),
	});
	const parsed = schema.safeParse(json);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}

	const { html, errors } = await compileMjmlToHtml(parsed.data.body_mjml);
	if (errors.length && !html?.trim()) {
		return adminErrorResponse("MJML compile failed", { details: { mjml_errors: errors } });
	}

	const [verRow] = await db
		.select({ maxv: max(emailTemplates.version) })
		.from(emailTemplates)
		.where(eq(emailTemplates.slug, parsed.data.slug));

	const nextVersion = (verRow?.maxv ?? 0) + 1;

	await writeAdminAction({
		action: ADMIN_ACTIONS.EMAIL_TEMPLATE_VERSION_CREATE,
		payload: { slug: parsed.data.slug, version: nextVersion },
	});

	const [row] = await db
		.insert(emailTemplates)
		.values({
			slug: parsed.data.slug,
			version: nextVersion,
			subjectTmpl: parsed.data.subject_tmpl,
			bodyMjml: parsed.data.body_mjml,
			bodyHtml: html,
			variables: (parsed.data.variables ?? {}) as Record<string, unknown>,
			isActive: false,
			notes: parsed.data.notes ?? null,
		})
		.returning();

	// Two-field success body (`data` + `mjml_warnings`) — keep client contract.
	return NextResponse.json({ data: row, mjml_warnings: errors }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
}
