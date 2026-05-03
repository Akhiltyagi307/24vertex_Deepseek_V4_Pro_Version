"use client";

import { useEffect, useState } from "react";

type Row = {
	id: string;
	profile_id: string;
	subscription_id: string | null;
	redeemed_at: string;
	full_name: string;
	email: string | null;
};

export function AdminCouponRedemptions({ code }: { code: string }) {
	const [rows, setRows] = useState<Row[] | null>(null);

	useEffect(() => {
		const enc = encodeURIComponent(code);
		void (async () => {
			const res = await fetch(`/api/admin/coupons/${enc}/redemptions?page_size=50`, { credentials: "include" });
			const j = (await res.json()) as { data?: Row[] };
			if (res.ok) setRows(j.data ?? []);
			else setRows([]);
		})();
	}, [code]);

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
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
