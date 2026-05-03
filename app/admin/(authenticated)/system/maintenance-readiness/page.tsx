import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";

export const metadata = {
	title: "Admin maintenance readiness · EduAI",
	robots: { index: false, follow: false },
};

export default function AdminMaintenanceReadinessPage() {
	return (
		<div className="max-w-2xl space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/maintenance-readiness" },
					{ label: "Maintenance readiness" },
				]}
				title="Maintenance mode readiness"
				description="Public traffic can be redirected to /maintenance while admin routes stay available."
			/>
			<div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
				<ul className="list-disc space-y-2 pl-5">
					<li>
						<strong className="text-foreground">Env var:</strong> <code className="text-xs">MAINTENANCE_MODE</code>{" "}
						— when set to <code className="text-xs">true</code>, non-admin HTML routes are redirected to{" "}
						<code className="text-xs">/maintenance</code> (see{" "}
						<code className="text-xs">proxy.ts</code> +{" "}
						<code className="text-xs">src/lib/admin/maintenance-routing.ts</code>).
					</li>
					<li>
						<strong className="text-foreground">Admin:</strong> paths under <code className="text-xs">/admin</code>{" "}
						and admin APIs are not redirected, so operators can still sign in and recover.
					</li>
					<li>
						<strong className="text-foreground">Public page:</strong>{" "}
						<Link className="text-primary underline" href="/maintenance">
							/maintenance
						</Link>{" "}
						is the user-facing holding page.
					</li>
				</ul>
				<p className="text-sm">
					Documented in <code className="text-xs">.env.example</code> — configure in Vercel for each environment;
					never commit real secrets.
				</p>
			</div>
		</div>
	);
}
