import "server-only";

import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { adminActionLog } from "@/db/schema/admin-action-log";

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Builds weekly operator digest HTML (PDR §5.4). Safe to call from cron — no secrets in output.
 */
export async function buildAdminWeeklyDigestHtml(): Promise<{ subject: string; html: string }> {
	const since = new Date();
	since.setDate(since.getDate() - 7);

	const [{ total }] = await db
		.select({ total: count() })
		.from(adminActionLog)
		.where(gte(adminActionLog.createdAt, since));

	const [{ logins }] = await db
		.select({ logins: count() })
		.from(adminActionLog)
		.where(and(gte(adminActionLog.createdAt, since), eq(adminActionLog.action, "login")));

	const [{ destructive }] = await db
		.select({ destructive: count() })
		.from(adminActionLog)
		.where(
			and(
				gte(adminActionLog.createdAt, since),
				sql`(
          ${adminActionLog.action} ilike '%delete%'
          or ${adminActionLog.action} ilike '%hard%'
          or ${adminActionLog.action} ilike '%suspend%'
          or ${adminActionLog.action} ilike '%revoke%'
          or ${adminActionLog.action} ilike '%panic%'
        )`,
			),
		);

	const topTargets = await db
		.select({
			targetId: adminActionLog.targetId,
			n: count(),
		})
		.from(adminActionLog)
		.where(and(gte(adminActionLog.createdAt, since), sql`${adminActionLog.targetId} is not null`))
		.groupBy(adminActionLog.targetId)
		.orderBy(desc(count()))
		.limit(10);

	const lines = [
		`<p>Summary for the last <strong>7 days</strong> (UTC).</p>`,
		`<ul>`,
		`<li>Total admin actions: <strong>${total}</strong></li>`,
		`<li>Logins: <strong>${logins}</strong></li>`,
		`<li>High-friction actions (delete/suspend/revoke/panic pattern): <strong>${destructive}</strong></li>`,
		`<li>DSRs fulfilled: <strong>—</strong> (compliance module)</li>`,
		`<li>Webhook replays: <strong>—</strong> (use audit search for <code>replay</code>)</li>`,
		`</ul>`,
		`<p><strong>Top target IDs</strong> by action volume:</p>`,
		`<ol>`,
		...topTargets.map((t) => `<li><code>${escapeHtml(String(t.targetId ?? ""))}</code> — ${t.n}</li>`),
		`</ol>`,
		`<p class="muted" style="color:#666;font-size:12px">Sent automatically for 24Vertex admin operations.</p>`,
	];

	const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">${lines.join("\n")}</body></html>`;
	const subject = `24Vertex admin weekly digest · ${since.toISOString().slice(0, 10)}`;
	return { subject, html };
}
