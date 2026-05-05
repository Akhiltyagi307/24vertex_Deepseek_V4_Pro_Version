import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { adminActionScope, consumeAdminActionRateLimit } from "@/lib/admin/rate-limit-action";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { broadcastBodyToEmailHtml } from "@/lib/admin/broadcast-markdown";
import { listBroadcastRecipients, type BroadcastAudienceJson } from "@/lib/admin/broadcast-audience";
import { filterAllowedBroadcastRecipients } from "@/lib/admin/broadcast-recipient-filter";
import { db } from "@/db";
import { broadcasts } from "@/db/schema/broadcasts";
import { notifications } from "@/db/schema/comms-audit";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";
import { MAX_NOTIFICATION_BODY_LEN } from "@/lib/notifications/insert";
import { getNotificationPrefsForUsers } from "@/lib/notifications/prefs";

export const runtime = "nodejs";

const CHUNK = 200;
const EMAIL_CONCURRENCY = 10;

// Tighter than refund: each send fans out N emails. 3/min is enough for a
// support agent retrying after a UI fumble, but stops a runaway script from
// dispatching dozens of all-user broadcasts before someone notices.
const BROADCAST_SEND_LIMIT = 3;
const BROADCAST_SEND_WINDOW_SEC = 60;

type Channels = { in_app: boolean; email: boolean; priority_urgent: boolean };

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;

	const ip = clientIpFromRequest(request);
	const ua = userAgentFromRequest(request);
	const rl = await consumeAdminActionRateLimit({
		action: ADMIN_ACTIONS.BROADCAST_SEND,
		scope: adminActionScope({ jti: gate.jti, ip }),
		limit: BROADCAST_SEND_LIMIT,
		windowSec: BROADCAST_SEND_WINDOW_SEC,
	});
	if (!rl.allowed) {
		void writeAdminAction({
			action: ADMIN_ACTIONS.BROADCAST_SEND,
			targetType: "broadcast",
			targetId: id,
			payload: { rate_limited: true, reset_at: rl.resetAt.toISOString() },
			ipAddress: ip,
			userAgent: ua,
		});
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return adminErrorResponse("Too many broadcast sends. Slow down.", {
			status: 429,
			code: "rate_limited",
			headers: { "Retry-After": String(retryAfterSec) },
		});
	}

	const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
	if (!b) {
		return adminErrorResponse("Not found", { status: 404 });
	}
	if (b.status === "sending" || b.status === "sent") {
		return adminErrorResponse("Already sent or in progress");
	}

	const audience = b.audienceJson as BroadcastAudienceJson;
	const channels = b.channelsJson as Channels;
	const inApp = channels.in_app !== false;
	const email = channels.email === true;
	const urgent = channels.priority_urgent === true;

	// Strict: a send-event audit is required before fanout begins. This is
	// what tells compliance an admin actually triggered a mass send vs. a
	// scheduled send vs. a test send.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.BROADCAST_SEND,
		targetType: "broadcast",
		targetId: id,
		ipAddress: ip,
		userAgent: ua,
	});
	await db.update(broadcasts).set({ status: "sending", error: null }).where(eq(broadcasts.id, id));

	const subject = b.subject;
	const bodyMd = b.bodyMd;
	const emailHtml = broadcastBodyToEmailHtml(bodyMd);
	let totalRecipients = 0;
	let emailSent = 0;
	let inAppSent = 0;
	const errors: string[] = [];

	try {
		for (let offset = 0; ; offset += CHUNK) {
			const batch = await listBroadcastRecipients(audience, { limit: CHUNK, offset });
			if (batch.length === 0) break;
			totalRecipients += batch.length;

			// One prefs query per chunk, then a pure filter — keeps the hot path
			// O(chunks). totalRecipients still reflects audience size; inAppSent
			// and emailSent now reflect the gated-down delivery counts.
			const prefsByUserId = await getNotificationPrefsForUsers(batch.map((r) => r.id));
			const { inAppAllowed, emailAllowed } = filterAllowedBroadcastRecipients(
				batch,
				prefsByUserId,
				{ inApp, email },
			);

			if (inApp && inAppAllowed.length > 0) {
				const notifRows = inAppAllowed.map((r) => ({
					recipientId: r.id,
					senderId: null as string | null,
					title: subject,
					body: bodyMd.slice(0, MAX_NOTIFICATION_BODY_LEN),
					type: "announcement" as const,
					priority: (urgent ? "urgent" : "normal") as "normal" | "urgent",
					category: "broadcast" as const,
					referenceType: "broadcast" as const,
					referenceId: id,
				}));
				await db.insert(notifications).values(notifRows);
				inAppSent += notifRows.length;
			}

			if (email && emailAllowed.length > 0) {
				for (let i = 0; i < emailAllowed.length; i += EMAIL_CONCURRENCY) {
					const slice = emailAllowed.slice(i, i + EMAIL_CONCURRENCY);
					await Promise.all(
						slice.map(async (r) => {
							const { error } = await sendHtmlEmailLogged({
								to: r.email!,
								subject,
								html: emailHtml,
								templateSlug: "broadcast",
								recipientUserId: r.id,
								unsubscribeRecipientUserId: r.id,
								broadcastId: id,
							});
							if (error) errors.push(`${r.email}: ${error}`);
							else emailSent++;
						}),
					);
				}
			}
		}

		await db
			.update(broadcasts)
			.set({
				status:
					errors.length > 0 && emailSent === 0 && inAppSent === 0 ?
						"failed"
					:	"sent",
				sentAt: new Date(),
				recipientCount: totalRecipients,
				statsJson: { email_sent: emailSent, in_app_sent: inAppSent, errors: errors.slice(0, 50) },
				error: errors.length ? errors.slice(0, 3).join("; ") : null,
			})
			.where(eq(broadcasts.id, id));

		return adminAckResponse({
			totalRecipients,
			emailSent,
			inAppSent,
			errors,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		await db
			.update(broadcasts)
			.set({ status: "failed", error: msg })
			.where(eq(broadcasts.id, id));
		return adminErrorResponse(msg, { status: 500 });
	}
}
