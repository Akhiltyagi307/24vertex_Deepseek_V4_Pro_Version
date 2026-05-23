"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminCouponBulkForm() {
	const [busy, setBusy] = useState(false);
	const [count, setCount] = useState("10");
	const [plan, setPlan] = useState("pro_monthly");
	const [prefix, setPrefix] = useState("");
	const [out, setOut] = useState<string | null>(null);

	return (
		<div className="max-w-xl space-y-3 rounded-lg border border-border p-4">
			<h3 className="text-sm font-semibold">Bulk-generate coupons</h3>
			<p className="text-xs text-muted-foreground">POST /api/admin/coupons/bulk-generate. Each code is unique (max 200).</p>
			<div className="flex flex-wrap gap-2">
				<Input className="h-9 w-20" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
				<Input className="h-9 w-40 font-mono" placeholder="plan code" value={plan} onChange={(e) => setPlan(e.target.value)} />
				<Input className="h-9 w-32 font-mono" placeholder="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
				<Button
					type="button"
					size="sm"
					disabled={busy}
					onClick={async () => {
						setBusy(true);
						setOut(null);
						try {
							const n = Number(count);
							const res = await fetch("/api/admin/coupons/bulk-generate", {
								method: "POST",
								credentials: "include",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									count: n,
									grants_plan_code: plan.trim(),
									code_prefix: prefix.trim() || undefined,
								}),
							});
							const j = (await res.json()) as { codes?: string[]; error?: string; partial_codes?: string[] };
							if (!res.ok) throw new Error(j.error ?? res.statusText);
							setOut((j.codes ?? []).join("\n"));
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(false);
						}
					}}
				>
					{busy ? "…" : "Generate"}
				</Button>
			</div>
			{out ?
				<pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-xs">{out}</pre>
			:	null}
		</div>
	);
}
