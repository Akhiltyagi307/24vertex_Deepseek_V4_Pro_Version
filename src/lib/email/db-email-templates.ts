import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";

function interpolateTemplate(tmpl: string, variables: Record<string, string>): string {
	let out = tmpl;
	for (const [k, v] of Object.entries(variables)) {
		out = out.split(`{{${k}}}`).join(v);
	}
	return out;
}

/**
 * When an active `email_templates` row exists for `slug`, returns rendered subject + HTML.
 * Otherwise returns null so callers fall back to built-in React/string templates.
 */
export async function renderActiveEmailTemplate(
	slug: string,
	variables: Record<string, string> = {},
): Promise<{ subject: string; html: string } | null> {
	const rows = await db
		.select()
		.from(emailTemplates)
		.where(and(eq(emailTemplates.slug, slug), eq(emailTemplates.isActive, true)))
		.orderBy(desc(emailTemplates.version))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	return {
		subject: interpolateTemplate(row.subjectTmpl, variables),
		html: interpolateTemplate(row.bodyHtml, variables),
	};
}
