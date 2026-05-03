import "server-only";

import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";
import { renderActiveEmailTemplate } from "@/lib/email/db-email-templates";
import { getResendApiKey, getResendFrom } from "@/lib/env";

export type SendHtmlEmailLoggedParams = {
	to: string;
	subject: string;
	html: string;
	templateSlug: string;
	recipientUserId?: string | null;
	broadcastId?: string | null;
	/** When an active DB template exists for templateSlug, interpolates these into subject/body. */
	templateVariables?: Record<string, string>;
};

/**
 * Sends via Resend and mirrors the attempt in `email_log` (queued → sent/failed).
 * If a DB-backed template is active for {@link SendHtmlEmailLoggedParams.templateSlug}, it overrides subject/html.
 */
export async function sendHtmlEmailLogged(params: SendHtmlEmailLoggedParams): Promise<{ error: string | null }> {
	const dbRendered = await renderActiveEmailTemplate(params.templateSlug, params.templateVariables ?? {});
	const subject = dbRendered?.subject ?? params.subject;
	const html = dbRendered?.html ?? params.html;

	const [inserted] = await db
		.insert(emailLog)
		.values({
			recipientEmail: params.to,
			recipientId: params.recipientUserId ?? null,
			subject,
			template: params.templateSlug,
			status: "queued",
			broadcastId: params.broadcastId ?? null,
		})
		.returning({ id: emailLog.id });

	const logId = inserted?.id;
	if (!logId) {
		return { error: "Could not create email log row." };
	}

	try {
		const resend = new Resend(getResendApiKey());
		const { data, error } = await resend.emails.send({
			from: getResendFrom(),
			to: params.to,
			subject,
			html,
		});
		if (error) {
			await db
				.update(emailLog)
				.set({
					status: "failed",
					errorMessage: error.message,
					sentAt: new Date(),
				})
				.where(eq(emailLog.id, logId));
			return { error: error.message };
		}
		await db
			.update(emailLog)
			.set({
				status: "sent",
				providerMessageId: data?.id ?? null,
				sentAt: new Date(),
			})
			.where(eq(emailLog.id, logId));
		return { error: null };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		await db
			.update(emailLog)
			.set({
				status: "failed",
				errorMessage: msg,
				sentAt: new Date(),
			})
			.where(eq(emailLog.id, logId));
		return { error: msg };
	}
}
