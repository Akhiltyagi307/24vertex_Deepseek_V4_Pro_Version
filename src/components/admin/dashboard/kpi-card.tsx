export function AdminKpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
	return (
		<div className="rounded-xl border border-border bg-card p-4 shadow-sm">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
			{hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	);
}
