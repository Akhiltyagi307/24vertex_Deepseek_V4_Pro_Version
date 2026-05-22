import Link from "next/link";
import { desc } from "drizzle-orm";

import { FeedbackReportRowActions } from "@/components/admin/feedback/feedback-report-row-actions";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { userFeedbackReports } from "@/db/schema/user-feedback-reports";

function userAdminHref(portal: string, userId: string): string {
	if (portal === "teacher") return `/admin/users/teachers?highlight=${userId}`;
	if (portal === "parent") return `/admin/users/parents?highlight=${userId}`;
	return `/admin/users/students?highlight=${userId}`;
}

function sentryIssueUrl(eventId: string | null | undefined): string | null {
	if (!eventId) return null;
	const org = process.env.SENTRY_ORG_SLUG;
	const project = process.env.SENTRY_PROJECT_SLUG;
	if (!org || !project) return null;
	return `https://sentry.io/organizations/${org}/issues/?query=${encodeURIComponent(eventId)}`;
}

export default async function AdminFeedbackPage() {
	const rows = await db
		.select()
		.from(userFeedbackReports)
		.orderBy(desc(userFeedbackReports.createdAt))
		.limit(150);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/jobs" },
					{ label: "User feedback" },
				]}
				title="User feedback"
				description="Reports from student, teacher, and parent portals (top-bar Help & feedback)."
			/>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[1100px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">Created</th>
							<th className="px-3 py-2 font-medium">Portal</th>
							<th className="px-3 py-2 font-medium">Category</th>
							<th className="px-3 py-2 font-medium">Impact</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">User</th>
							<th className="px-3 py-2 font-medium">Page</th>
							<th className="px-3 py-2 font-medium">Description</th>
							<th className="px-3 py-2 font-medium">Sentry</th>
							<th className="px-3 py-2 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ?
							<tr>
								<td colSpan={10} className="px-3 py-6 text-muted-foreground">
									No feedback reports yet.
								</td>
							</tr>
						:	rows.map((r) => {
								const sentryUrl = sentryIssueUrl(r.sentryEventId);
								return (
									<tr key={r.id} className="border-b border-border/80 align-top">
										<td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
											{r.createdAt?.toISOString() ?? ""}
										</td>
										<td className="px-3 py-2">{r.portal}</td>
										<td className="px-3 py-2">{r.category}</td>
										<td className="px-3 py-2">{r.impact ?? "—"}</td>
										<td className="px-3 py-2">{r.status}</td>
										<td className="px-3 py-2 font-mono text-xs">
											<Link
												href={userAdminHref(r.portal, r.userId)}
												className="text-primary underline-offset-4 hover:underline"
											>
												{r.userId.slice(0, 8)}…
											</Link>
										</td>
										<td className="px-3 py-2 max-w-[10rem] truncate font-mono text-xs" title={r.pagePath}>
											{r.pagePath}
										</td>
										<td className="px-3 py-2 max-w-md">
											{r.title ?
												<p className="font-medium text-foreground">{r.title}</p>
											:	null}
											<p className="text-muted-foreground line-clamp-3">{r.description}</p>
										</td>
										<td className="px-3 py-2 font-mono text-xs">
											{sentryUrl ?
												<a
													href={sentryUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="text-primary underline-offset-4 hover:underline"
												>
													{r.sentryEventId?.slice(0, 8)}…
												</a>
											:	r.sentryEventId ?
												<span title={r.sentryEventId}>{r.sentryEventId.slice(0, 8)}…</span>
											:	"—"}
										</td>
										<td className="px-3 py-2">
											<FeedbackReportRowActions reportId={r.id} initialStatus={r.status} />
										</td>
									</tr>
								);
							})
						}
					</tbody>
				</table>
			</div>
		</div>
	);
}
