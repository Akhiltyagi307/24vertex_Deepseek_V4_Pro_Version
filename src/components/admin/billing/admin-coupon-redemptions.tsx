"use client";

import { z } from "zod";

import { useJsonResource } from "@/hooks/use-json-resource";

const rowSchema = z.object({
	id: z.string(),
	profile_id: z.string(),
	subscription_id: z.string().nullable(),
	redeemed_at: z.string(),
	refunded_at: z.string().nullable(),
	full_name: z.string(),
	email: z.string().nullable(),
});

type Row = z.infer<typeof rowSchema>;

const redemptionsSchema = z
	.object({ data: z.array(rowSchema).optional() })
	.transform((j) => j.data ?? []);

export function AdminCouponRedemptions({ code }: { code: string }) {
	const enc = encodeURIComponent(code);
	const { data, error } = useJsonResource<Row[]>(`/api/admin/coupons/${enc}/redemptions?page_size=50`, {
		schema: redemptionsSchema,
	});
	// Preserve the original behaviour: failures render the empty state (never an
	// error message); only the pre-first-response state shows the loading copy.
	const rows = error ? [] : data;

	if (rows === null) return <p className="text-sm text-muted-foreground">Loading redemptions…</p>;
	if (rows.length === 0) return <p className="text-sm text-muted-foreground">No redemptions yet.</p>;

	return (
		<div className="overflow-x-auto rounded-lg border border-border">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<th className="px-3 py-2">Redeemed</th>
						<th className="px-3 py-2">User</th>
						<th className="px-3 py-2">Subscription</th>
						<th className="px-3 py-2">Status</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.id} className="border-b border-border/80">
							<td className="px-3 py-2 text-muted-foreground">{r.redeemed_at.slice(0, 19)}</td>
							<td className="px-3 py-2">
								{r.full_name}
								{r.email ? <span className="block text-xs text-muted-foreground">{r.email}</span> : null}
							</td>
							<td className="px-3 py-2 font-mono text-xs">{r.subscription_id ?? "—"}</td>
							<td className="px-3 py-2">
								{r.refunded_at ? (
									<span
										title={`Refunded at ${r.refunded_at.slice(0, 19)}`}
										className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
									>
										Refunded
									</span>
								) : (
									<span className="text-xs text-muted-foreground">Active</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
