import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";
import { renderActiveEmailTemplate } from "@/lib/email/db-email-templates";
import { signUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { getAppUrl, getResendApiKey, getResendFrom } from "@/lib/env";

export type SendHtmlEmailLoggedParams = {
	to: string;
	subject: string;
	html: string;
	templateSlug: string;
	recipientUserId?: string | null;
	broadcastId?: string | null;
	/** When an active DB template exists for templateSlug, interpolates these into subject/body. */
	templateVariables?: Record<string, string>;
	/**
	 * Optional idempotency key. When provided, we look for an existing
	 * `(template, dedupKey)` row in `email_log` that succeeded or is in flight
	 * and skip the send. The key is stored under
	 * `provider_payload.dedup_key` so we don't need a schema change.
	 *
	 * Use a stable, distinguishing string per "thing being notified about" —
	 * e.g. `report-ready:${testId}:student:${studentId}`.
	 */
	dedupKey?: string;
	/**
	 * When set (and `EMAIL_UNSUBSCRIBE_SECRET` is configured), the email goes
	 * out with RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post` headers
	 * pointing at `/api/email/unsubscribe?t=<signed>`. Pass for marketing /
	 * non-critical transactional sends (report-ready, usage-threshold,
	 * trial reminders, billing receipts, broadcasts). Omit for security and
	 * compliance flows that should always reach the user (password change,
	 * email change, parent-link confirmations, DSR fulfillments).
	 */
	unsubscribeRecipientUserId?: string | null;
};

/**
 * Builds the `List-Unsubscribe` + `List-Unsubscribe-Post` header pair when a
 * recipient id is provided and the unsubscribe secret is configured. Returns
 * `null` to mean "skip the headers entirely" (the call still goes out).
 */
function buildUnsubscribeHeaders(recipientUserId: string | null | undefined): Record<string, string> | null {
	if (!recipientUserId) return null;
	const token = signUnsubscribeToken(recipientUserId);
	if (!token) return null;
	const url = `${getAppUrl()}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
	return {
		"List-Unsubscribe": `<${url}>`,
		"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
	};
}

async function findExistingLogForDedup(
	template: string,
	dedupKey: string,
): Promise<{ id: string; status: string | null } | null> {
	const rows = await db
		.select({ id: emailLog.id, status: emailLog.status })
		.from(emailLog)
		.where(
			and(
				eq(emailLog.template, template),
				inArray(emailLog.status, ["sent", "queued"]),
				sql`${emailLog.providerPayload}->>'dedup_key' = ${dedupKey}`,
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

/** Postgres unique_violation — raised by the partial unique index added in 20260527120000. */
function isPgUniqueViolation(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		(err as { code?: string }).code === "23505"
	);
}

/**
 * Sends via Resend and mirrors the attempt in `email_log` (queued → sent/failed).
 * If a DB-backed template is active for {@link SendHtmlEmailLoggedParams.templateSlug}, it overrides subject/html.
 * Pass {@link SendHtmlEmailLoggedParams.dedupKey} to skip duplicate sends across retries / racing call paths.
 *
 * Two-layer dedup:
 *   1. Pre-flight read of `email_log` for an existing (template, dedup_key)
 *      row in `('sent', 'queued')` status — fast, catches sequential retries.
 *   2. DB partial unique index `email_log_dedup_unique_idx` — closes the
 *      race where two concurrent calls both pass step 1. The second insert
 *      raises 23505 unique_violation, which we treat as "already in flight"
 *      and return ok.
 */
export async function sendHtmlEmailLogged(params: SendHtmlEmailLoggedParams): Promise<{ error: string | null }> {
	if (params.dedupKey) {
		const existing = await findExistingLogForDedup(params.templateSlug, params.dedupKey);
		if (existing) return { error: null };
	}

	const dbRendered = await renderActiveEmailTemplate(params.templateSlug, params.templateVariables ?? {});
	const subject = dbRendered?.subject ?? params.subject;
	const html = dbRendered?.html ?? params.html;

	const initialPayload = params.dedupKey ? { dedup_key: params.dedupKey } : null;

	let inserted: { id: string } | undefined;
	try {
		[inserted] = await db
			.insert(emailLog)
			.values({
				recipientEmail: params.to,
				recipientId: params.recipientUserId ?? null,
				subject,
				template: params.templateSlug,
				status: "queued",
				broadcastId: params.broadcastId ?? null,
				providerPayload: initialPayload,
			})
			.returning({ id: emailLog.id });
	} catch (e) {
		// The partial unique index rejected this insert because another caller
		// raced ahead and is already sending the same (template, dedup_key).
		// Treat as deduped — the other caller will land the actual send.
		if (params.dedupKey && isPgUniqueViolation(e)) {
			return { error: null };
		}
		throw e;
	}

	const logId = inserted?.id;
	if (!logId) {
		return { error: "Could not create email log row." };
	}

	const unsubscribeHeaders = buildUnsubscribeHeaders(params.unsubscribeRecipientUserId);

	try {
		const resend = new Resend(getResendApiKey());
		const { data, error } = await resend.emails.send({
			from: getResendFrom(),
			to: params.to,
			subject,
			html,
			...(unsubscribeHeaders ? { headers: unsubscribeHeaders } : {}),
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
