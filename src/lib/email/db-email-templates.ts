import "server-only";

import * as Sentry from "@sentry/nextjs";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";
import { escapeHtml } from "@/lib/email/render-email-shell";

const TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Replaces every `{{key}}` occurrence in the template with the matching value
 * from the variable bag. **Values are HTML-escaped before substitution** so an
 * attacker-controlled string (e.g. a student's full name) cannot inject markup
 * into an admin-authored template body. Templates themselves are admin-written
 * and trusted; variables originate from user data and are not.
 *
 * Callers should pass the **raw** value — do not pre-escape, or you will see
 * literal entities (`&amp;#39;`) in the output.
 *
 * Tokens with no matching variable are blanked out (instead of leaving the
 * literal `{{name}}` in the email) and reported to Sentry so the missing
 * variable is visible in observability rather than silently shipped to users.
 */
function interpolateTemplate(
	tmpl: string,
	variables: Record<string, string>,
	context: { slug?: string } = {},
): string {
	const missing = new Set<string>();
	const out = tmpl.replace(TOKEN_REGEX, (_match, name: string) => {
		if (Object.prototype.hasOwnProperty.call(variables, name)) {
			return escapeHtml(variables[name]);
		}
		missing.add(name);
		return "";
	});
	if (missing.size > 0) {
		Sentry.captureMessage(
			`email template missing variables: ${[...missing].join(", ")}`,
			{
				level: "warning",
				tags: { component: "email.template", template_slug: context.slug ?? "" },
				extra: { missing: [...missing] },
			},
		);
	}
	return out;
}

/**
 * When an active `email_templates` row exists for `slug`, returns rendered subject + HTML.
 * Otherwise returns null so callers fall back to built-in React/string templates.
 *
 * Variable values are HTML-escaped during interpolation to defeat injection
 * via user-controlled fields. See {@link interpolateTemplate}.
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
		subject: interpolateTemplate(row.subjectTmpl, variables, { slug }),
		html: interpolateTemplate(row.bodyHtml, variables, { slug }),
	};
}

export const __test = { interpolateTemplate };
