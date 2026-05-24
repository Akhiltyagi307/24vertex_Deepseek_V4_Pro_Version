import Link from "next/link";

import { AdminAuditTable, type AdminAuditRow } from "@/components/admin/audit/admin-audit-table";

interface AuditTabProps {
	auditHref: string;
	sessionRevokeAuditHref: string;
	rows: AdminAuditRow[];
}

export function AuditTab({ auditHref, sessionRevokeAuditHref, rows }: AuditTabProps) {
	return (
		<div className="space-y-4 rounded-lg border border-border p-4 text-sm">
			<p className="text-muted-foreground">
				Recent operator actions with <code className="text-xs">target_id</code> equal to this profile.
				Actions that logged a different target (for example a test id) may not appear here.
			</p>
			<AdminAuditTable
				caption="Audit log entries for this user"
				rows={rows}
				emptyMessage="No audit entries for this user id yet."
			/>
			<div className="flex flex-wrap gap-x-4 gap-y-1">
				<Link
					className="inline-block text-primary text-sm font-medium underline-offset-4 hover:underline"
					href={auditHref}
				>
					Open full audit log with filters
				</Link>
				<Link
					className="inline-block text-primary text-sm font-medium underline-offset-4 hover:underline"
					href={sessionRevokeAuditHref}
				>
					Session revoke actions only
				</Link>
			</div>
		</div>
	);
}
