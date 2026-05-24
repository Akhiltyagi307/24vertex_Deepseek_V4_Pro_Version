import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { eq } from "drizzle-orm";

import { ActionFailureDetailActions } from "@/components/admin/billing/action-failure-detail-actions";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { db } from "@/db";
import { billingActionFailures } from "@/db/schema/billing";

export const metadata = {
	title: "Admin · Billing · Action failure",
	robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminBillingActionFailureDetailPage({ params }: Props) {
	const id = (await params).id;
	const rows = await db.select().from(billingActionFailures).where(eq(billingActionFailures.id, id)).limit(1);
	const row = rows[0];
	if (!row) notFound();

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Action failures", href: "/admin/billing/action-failures" },
					{ label: row.id.slice(0, 8) },
				]}
				title="Action failure"
				description={`${row.kind} · ${row.resolvedAt ? "resolved" : "open"}`}
			/>

			<p className="text-sm">
				<Link className="text-primary underline-offset-4 hover:underline" href="/admin/billing/action-failures">
					← Back to list
				</Link>
			</p>

			<div className="grid max-w-3xl gap-3 rounded-lg border border-border p-4 text-sm">
				<Row label="Status" value={row.resolvedAt ? "resolved" : "open"} />
				<Row label="Created" value={formatDateTimeMediumShortInAppTimeZone(row.createdAt)} />
				{row.resolvedAt ?
					<Row label="Resolved" value={formatDateTimeMediumShortInAppTimeZone(row.resolvedAt)} />
				:	null}
				<Row label="Kind" value={row.kind} />
				<Row label="Retries" value={String(row.retryCount)} />
				<Row
					label="Last retry"
					value={row.lastRetryAt ? formatDateTimeMediumShortInAppTimeZone(row.lastRetryAt) : "—"}
				/>
				<Row label="Profile">
					{row.profileId ?
						<Link className="text-primary underline" href={`/admin/users/${row.profileId}`}>
							{row.profileId}
						</Link>
					:	"—"}
				</Row>
				<Row label="Subscription">
					{row.subscriptionId ?
						<Link
							className="text-primary underline"
							href={`/admin/billing/subscriptions/${row.subscriptionId}`}
						>
							{row.subscriptionId}
						</Link>
					:	"—"}
				</Row>
				<Row label="Payment">
					{row.paymentId ?
						<Link className="text-primary underline" href={`/admin/billing/payments/${row.paymentId}`}>
							{row.paymentId}
						</Link>
					:	"—"}
				</Row>
				<Row label="Razorpay event" value={row.razorpayEventId ?? "—"} />
				<Row label="Error" value={row.errorMessage} />
				{row.resolutionNote ?
					<Row label="Resolution note" value={row.resolutionNote} />
				:	null}
			</div>

			<section className="space-y-2">
				<h2 className="text-sm font-semibold">Payload</h2>
				<pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
					{JSON.stringify(row.payload, null, 2)}
				</pre>
			</section>

			<ActionFailureDetailActions failureId={row.id} resolved={Boolean(row.resolvedAt)} />
		</div>
	);
}

function Row({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
	return (
		<div className="grid gap-1 medium:grid-cols-[140px_1fr]">
			<span className="text-muted-foreground">{label}</span>
			<span className="break-all">{children ?? value}</span>
		</div>
	);
}
