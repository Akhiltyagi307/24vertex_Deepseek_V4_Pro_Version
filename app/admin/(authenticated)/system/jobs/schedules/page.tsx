import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";

export const metadata = {
	title: "Job schedules · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default function AdminJobSchedulesPage() {
	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Jobs", href: "/admin/system/jobs" },
					{ label: "Schedules" },
				]}
				title="Schedules"
				description="Schedules are Supabase pg_cron jobs (see migration `20260516100000_internal_http_routes_pg_cron.sql`); Vault secrets `app_base_url` + `cron_secret`."
			/>
			<p className="text-sm text-muted-foreground">
				See <code className="rounded bg-muted px-1">GET /api/admin/jobs/schedules</code> for JSON.
			</p>
		</div>
	);
}
