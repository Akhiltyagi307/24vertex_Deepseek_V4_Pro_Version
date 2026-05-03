import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { ComplianceRequestDetailActions } from "@/components/admin/compliance/compliance-request-detail-actions";
import { DeadlineBadge } from "@/components/admin/compliance/deadline-badge";
import { IdentityVerificationPanel } from "@/components/admin/compliance/identity-verification-panel";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const metadata = {
	title: "Compliance · Request · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminComplianceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const [row] = await db.select().from(complianceRequests).where(eq(complianceRequests.id, id)).limit(1);
	if (!row) notFound();

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Compliance", href: "/admin/compliance/requests" },
					{ label: "Request" },
				]}
				title={`DSR · ${row.requestType}`}
				description={row.requesterEmail}
			/>
			<div className="-mt-4 mb-4 flex flex-wrap items-center gap-3 text-sm">
				<DeadlineBadge dueAt={row.dueAt} />
				<Link href="/admin/compliance/requests" className="text-primary underline">
					All requests
				</Link>
			</div>
			<div className="grid gap-6 medium:grid-cols-2">
				<div className="space-y-2 rounded-lg border border-border p-4 text-sm">
					<p>
						<span className="text-muted-foreground">Status:</span> {row.status}
					</p>
					<p>
						<span className="text-muted-foreground">Legal basis:</span> {row.legalBasis}
					</p>
					<p>
						<span className="text-muted-foreground">Subject user:</span>{" "}
						{row.subjectUserId ?
							<Link className="font-mono text-xs text-primary underline" href={`/admin/users/${row.subjectUserId}`}>
								{row.subjectUserId}
							</Link>
						:	"—"}
					</p>
					<p>
						<span className="text-muted-foreground">Identity verified:</span> {row.identityVerified ? "yes" : "no"}
					</p>
					{row.notes ?
						<p className="whitespace-pre-wrap text-muted-foreground">{row.notes}</p>
					:	null}
				</div>
				<IdentityVerificationPanel requestId={row.id} initialVerified={row.identityVerified} />
			</div>
			<ComplianceRequestDetailActions
				requestId={row.id}
				requestType={row.requestType}
				identityVerified={row.identityVerified}
				hasSubjectUserId={Boolean(row.subjectUserId)}
			/>
		</div>
	);
}
