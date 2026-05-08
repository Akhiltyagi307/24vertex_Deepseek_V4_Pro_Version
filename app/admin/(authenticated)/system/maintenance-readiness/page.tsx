import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { formatRelativeTime } from "@/components/student/notifications/relative-time";
import { cn } from "@/lib/utils";
import { getMaintenanceReadiness, type MaintenanceReadinessSignal } from "@/lib/admin/maintenance-readiness";

export const metadata = {
	title: "Admin maintenance readiness · EduAI",
	robots: { index: false, follow: false },
};

const SEVERITY_STYLES: Record<MaintenanceReadinessSignal["severity"], { ring: string; pill: string; label: string }> = {
	ok: {
		ring: "border-border",
		pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
		label: "Clear",
	},
	warn: {
		ring: "border-amber-500/40",
		pill: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
		label: "Warn",
	},
	block: {
		ring: "border-rose-500/50",
		pill: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
		label: "Block",
	},
};

function aggregateVerdict(signals: MaintenanceReadinessSignal[]): "ok" | "warn" | "block" {
	if (signals.some((s) => s.severity === "block")) return "block";
	if (signals.some((s) => s.severity === "warn")) return "warn";
	return "ok";
}

export default async function AdminMaintenanceReadinessPage() {
	const readiness = await getMaintenanceReadiness();
	const verdict = aggregateVerdict(readiness.signals);
	const verdictStyle = SEVERITY_STYLES[verdict];

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/jobs" },
					{ label: "Maintenance readiness" },
				]}
				title="Maintenance mode readiness"
				description="Live signals to help decide whether it is safe to enable maintenance mode right now."
			/>

			<div
				className={cn(
					"rounded-xl border bg-card p-4 shadow-sm",
					readiness.maintenanceActive ? "border-amber-500/50" : "border-border",
				)}
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current state</p>
						<p className="mt-1 text-lg font-semibold">
							{readiness.maintenanceActive ? "Maintenance mode ACTIVE" : "Live (maintenance off)"}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Sources: env <code>MAINTENANCE_MODE</code>{" "}
							<span className="font-mono">{readiness.envFlag ? "true" : "false"}</span>
							{" · "}DB feature flag <span className="font-mono">{readiness.dbFlag ? "enabled" : "disabled"}</span>
						</p>
					</div>
					<span
						className={cn(
							"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
							verdictStyle.pill,
						)}
					>
						{verdict === "ok" ? "Safe to enter" : verdict === "warn" ? "Warnings" : "Blockers present"}
					</span>
				</div>
			</div>

			<div className="grid gap-3 medium:grid-cols-2 xl:grid-cols-3">
				{readiness.signals.map((s) => {
					const style = SEVERITY_STYLES[s.severity];
					return (
						<Link
							key={s.id}
							href={s.href}
							className={cn(
								"group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30",
								style.ring,
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
								<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", style.pill)}>
									{style.label}
								</span>
							</div>
							<p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{s.count.toLocaleString()}</p>
							<p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground">{s.hint}</p>
						</Link>
					);
				})}
			</div>

			<p className="text-xs text-muted-foreground">
				Snapshot taken {formatRelativeTime(readiness.checkedAt)} · refresh the page to recompute.
			</p>

			<div className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-border bg-muted/20 p-4 text-muted-foreground">
				<p className="m-0 text-xs font-medium uppercase tracking-wide text-foreground">How maintenance mode works</p>
				<ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
					<li>
						<strong className="text-foreground">Env var:</strong> <code className="text-xs">MAINTENANCE_MODE=true</code>{" "}
						redirects non-admin HTML routes to <code className="text-xs">/maintenance</code> (
						<code className="text-xs">proxy.ts</code> +{" "}
						<code className="text-xs">src/lib/admin/maintenance-routing.ts</code>).
					</li>
					<li>
						<strong className="text-foreground">DB flag:</strong> the <code className="text-xs">feature_flags</code>{" "}
						row keyed <code className="text-xs">MAINTENANCE_MODE</code> can act as a soft switch (no redeploy
						required); read by <code className="text-xs">isMaintenanceModeEnabled()</code>.
					</li>
					<li>
						<strong className="text-foreground">Admin isolation:</strong> paths under{" "}
						<code className="text-xs">/admin</code> and admin APIs stay reachable so operators can recover.
					</li>
					<li>
						<strong className="text-foreground">Public page:</strong>{" "}
						<Link className="text-primary underline" href="/maintenance">
							/maintenance
						</Link>{" "}
						is the user-facing holding page.
					</li>
				</ul>
			</div>
		</div>
	);
}
