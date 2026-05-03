import { sql } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";

export const metadata = {
	title: "Service health · EduAI Admin",
	robots: { index: false, follow: false },
};

export default async function AdminServiceHealthPage() {
	const rows = await db.execute(sql`
		SELECT DISTINCT ON (provider)
			provider,
			status,
			latency_ms,
			error,
			checked_at
		FROM public.service_health_pings
		ORDER BY provider, checked_at DESC
	`);

	const list = rows as unknown as Record<string, unknown>[];

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/sql-console" },
					{ label: "Health" },
				]}
				title="Third-party health"
				description="Latest ping per provider. Periodic runs use Supabase pg_cron → `/api/internal/admin/health-pings` (Vault `cron_secret` Bearer), or trigger the check API manually."
			/>
			<div className="grid gap-4 medium:grid-cols-2 xl:grid-cols-3">
				{list.length === 0 ?
					<p className="text-sm text-muted-foreground">No pings recorded yet.</p>
				:	list.map((r) => (
						<div key={String(r.provider)} className="rounded-md border border-border p-4">
							<div className="text-sm font-medium">{String(r.provider)}</div>
							<div className="mt-1 text-xs text-muted-foreground">status: {String(r.status)}</div>
							<div className="text-xs text-muted-foreground">
								latency: {r.latency_ms == null ? "—" : `${r.latency_ms}ms`}
							</div>
							{r.error ?
								<div className="mt-2 text-xs text-destructive">{String(r.error)}</div>
							:	null}
							<div className="mt-2 text-xs text-muted-foreground">{String(r.checked_at ?? "")}</div>
						</div>
					))
				}
			</div>
		</div>
	);
}
