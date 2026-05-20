export function SessionsTab() {
	return (
		<div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
			<p>
				End-user sessions are issued by Supabase Auth (refresh tokens). Inspect or revoke them
				from the Supabase dashboard for now. A first-class session list is planned for a later
				admin phase.
			</p>
		</div>
	);
}
