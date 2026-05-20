import Link from "next/link";

interface AuditTabProps {
	auditHref: string;
}

export function AuditTab({ auditHref }: AuditTabProps) {
	return (
		<div className="rounded-lg border border-border p-4 text-sm">
			<p className="text-muted-foreground">
				Operator actions that set <code className="text-xs">target_id</code> to this profile id
				appear in the filtered audit view. Some actions may log a different target (e.g. test id);
				use the full audit log and correlate by time if needed.
			</p>
			<Link
				className="mt-3 inline-block text-primary text-sm font-medium underline-offset-4 hover:underline"
				href={auditHref}
			>
				Open audit log for this user id
			</Link>
		</div>
	);
}
