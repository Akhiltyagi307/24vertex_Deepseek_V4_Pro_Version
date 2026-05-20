import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminUserTabPagination } from "@/components/admin/users/admin-user-tab-pagination";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";

import type { NotificationsList, UserTabPaginationState } from "./types";

interface NotificationsTabProps {
	userId: string;
	notificationsList: NotificationsList;
	pagination: UserTabPaginationState;
}

export function NotificationsTab({
	userId,
	notificationsList,
	pagination,
}: NotificationsTabProps) {
	const exportRows: Record<string, unknown>[] = notificationsList.rows.map((r) => ({
		id: r.id,
		created_at: r.created_at ?? "",
		type: r.type,
		title: r.title,
		body_preview: r.body_preview,
		is_read: r.is_read,
		email_sent: r.email_sent,
	}));
	return (
		<div className="space-y-3">
			<AdminServerRowsToolbar
				listId={ADMIN_LIST_ID.usersDetailNotifications}
				filenameBase={`user-${userId}-notifications`}
				headers={["id", "created_at", "type", "title", "body_preview", "is_read", "email_sent"]}
				rows={exportRows}
			/>
			<p className="text-sm text-muted-foreground">
				In-app notifications ({notificationsList.total} total). Body is truncated for the operator
				table.
			</p>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[880px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th scope="col" className="px-3 py-2 font-medium">
								When
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Type
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Title
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Preview
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Read
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Email
							</th>
						</tr>
					</thead>
					<tbody>
						{notificationsList.rows.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
									No notifications
								</td>
							</tr>
						) : (
							notificationsList.rows.map((r) => (
								<tr key={r.id} className="border-b border-border/80 align-top">
									<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
										{r.created_at ? formatDateTimeMediumShortInAppTimeZone(r.created_at) : "—"}
									</td>
									<td className="px-3 py-2">{r.type}</td>
									<td className="px-3 py-2">{r.title}</td>
									<td className="max-w-[280px] px-3 py-2 text-muted-foreground">
										{r.body_preview}
									</td>
									<td className="px-3 py-2">{r.is_read ? "Yes" : "No"}</td>
									<td className="px-3 py-2 text-xs">
										{r.email_sent
											? `Yes${
													r.email_sent_at
														? ` · ${formatDateTimeMediumShortInAppTimeZone(r.email_sent_at)}`
														: ""
												}`
											: "No"}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<AdminUserTabPagination
				userId={userId}
				tab="notifications"
				page={pagination.page}
				pageSize={pagination.pageSize}
				total={notificationsList.total}
			/>
		</div>
	);
}
