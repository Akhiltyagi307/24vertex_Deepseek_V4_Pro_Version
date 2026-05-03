import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { broadcastBodyToEmailHtml } from "@/lib/admin/broadcast-markdown";
import { listBroadcastRecipients, type BroadcastAudienceJson } from "@/lib/admin/broadcast-audience";
import { db } from "@/db";
import { broadcasts } from "@/db/schema/broadcasts";
import { notifications } from "@/db/schema/comms-audit";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export const runtime = "nodejs";

const CHUNK = 200;
const EMAIL_CONCURRENCY = 10;

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

type Channels = { in_app: boolean; email: boolean; priority_urgent: boolean };

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);
	if (!b) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}
	if (b.status === "sending" || b.status === "sent") {
		return NextResponse.json({ error: "Already sent or in progress" }, { status: 400, headers: adminHeaders() });
	}

	const audience = b.audienceJson as BroadcastAudienceJson;
	const channels = b.channelsJson as Channels;
	const inApp = channels.in_app !== false;
	const email = channels.email === true;
	const urgent = channels.priority_urgent === true;

	await writeAdminAction({ action: "broadcast_send", targetType: "broadcast", targetId: id });
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

			if (inApp) {
				const notifRows = batch.map((r) => ({
					recipientId: r.id,
					senderId: null as string | null,
					title: subject,
					body: bodyMd.slice(0, 8000),
					type: "announcement" as const,
					priority: (urgent ? "urgent" : "normal") as "normal" | "urgent",
					category: "broadcast" as const,
					referenceType: "broadcast" as const,
					referenceId: id,
				}));
				await db.insert(notifications).values(notifRows);
				inAppSent += notifRows.length;
			}

			if (email) {
				const emailJobs = batch.filter((r) => r.email && r.email.includes("@"));
				for (let i = 0; i < emailJobs.length; i += EMAIL_CONCURRENCY) {
					const slice = emailJobs.slice(i, i + EMAIL_CONCURRENCY);
					await Promise.all(
						slice.map(async (r) => {
							const { error } = await sendHtmlEmailLogged({
								to: r.email!,
								subject,
								html: emailHtml,
								templateSlug: "broadcast",
								recipientUserId: r.id,
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

		return NextResponse.json(
			{
				ok: true,
				totalRecipients,
				emailSent,
				inAppSent,
				errors,
			},
			{ headers: adminHeaders() },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		await db
			.update(broadcasts)
			.set({ status: "failed", error: msg })
			.where(eq(broadcasts.id, id));
		return NextResponse.json({ error: msg }, { status: 500, headers: adminHeaders() });
	}
}
