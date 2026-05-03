import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBillingEventActions } from "@/components/admin/billing/admin-billing-event-actions";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { billingEvents } from "@/db/schema/billing";

export const metadata = {
	title: "Admin · Billing · Event",
	robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminBillingEventDetailPage({ params }: Props) {
	const id = (await params).id;
	const rows = await db.select().from(billingEvents).where(eq(billingEvents.id, id)).limit(1);
	const row = rows[0];
	if (!row) notFound();

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Events", href: "/admin/billing/events" },
					{ label: row.eventType },
				]}
				title={row.eventType}
				description={row.razorpayEventId ? `Razorpay id: ${row.razorpayEventId}` : "Synthetic / admin replay"}
			/>

			<AdminBillingEventActions
				eventId={row.id}
				initialProcessedAt={row.processedAt?.toISOString() ?? null}
				initialResolvedAt={row.resolvedAt?.toISOString() ?? null}
			/>

			<div className="grid max-w-3xl gap-2 rounded-lg border border-border p-4 text-sm">
				<p>
					<span className="text-muted-foreground">Row id:</span>{" "}
					<span className="font-mono text-xs">{row.id}</span>
				</p>
				<p>
					<span className="text-muted-foreground">Created:</span> {row.createdAt.toISOString()}
				</p>
				<p>
					<span className="text-muted-foreground">Replay count:</span> {row.replayCount}
				</p>
				{row.lastReplayAt ?
					<p>
						<span className="text-muted-foreground">Last replay:</span> {row.lastReplayAt.toISOString()}
					</p>
				:	null}
				{row.error ?
					<p className="text-destructive">
						<span className="font-medium">Error:</span> {row.error}
					</p>
				:	null}
			</div>

			<div>
				<h3 className="mb-2 text-sm font-semibold">Payload</h3>
				<pre className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed">
					{JSON.stringify(row.payload, null, 2)}
				</pre>
			</div>

			<p className="text-sm text-muted-foreground">
				<Link className="text-primary underline-offset-4 hover:underline" href="/admin/billing/events">
					← All events
				</Link>
			</p>
		</div>
	);
}
