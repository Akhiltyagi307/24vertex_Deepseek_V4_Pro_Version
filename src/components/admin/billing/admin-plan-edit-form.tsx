"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PlanEditShape = {
	code: string;
	name: string;
	interval: string;
	price_paise: number;
	tests_per_period: number;
	tokens_grade_6_10: number;
	tokens_grade_11_12: number;
	pool_multiplier: number;
	is_active: boolean;
	sort_order: number;
	razorpay_plan_id: string | null;
};

type Props = { initial: PlanEditShape };

export function AdminPlanEditForm({ initial }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [form, setForm] = useState({
		name: initial.name,
		interval: initial.interval,
		price_paise: String(initial.price_paise),
		tests_per_period: String(initial.tests_per_period),
		tokens_grade_6_10: String(initial.tokens_grade_6_10),
		tokens_grade_11_12: String(initial.tokens_grade_11_12),
		pool_multiplier: String(initial.pool_multiplier),
		is_active: initial.is_active,
		sort_order: String(initial.sort_order),
	});

	const patch = async () => {
		const body = {
			name: form.name.trim(),
			interval: form.interval.trim(),
			price_paise: Number(form.price_paise),
			tests_per_period: Number(form.tests_per_period),
			tokens_grade_6_10: Number(form.tokens_grade_6_10),
			tokens_grade_11_12: Number(form.tokens_grade_11_12),
			pool_multiplier: Number(form.pool_multiplier),
			is_active: form.is_active,
			sort_order: Number(form.sort_order),
		};
		const res = await fetch(`/api/admin/plans/${encodeURIComponent(initial.code)}`, {
			method: "PATCH",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const j = (await res.json().catch(() => ({}))) as { error?: unknown };
		if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : res.statusText);
	};

	return (
		<div className="max-w-2xl space-y-4 rounded-lg border border-border p-4">
			<h3 className="text-sm font-semibold">Edit plan (local DB)</h3>
			<div className="grid gap-3 medium:grid-cols-2">
				<Field label="Name" id="p-name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
				<Field label="Interval" id="p-int" value={form.interval} onChange={(v) => setForm((f) => ({ ...f, interval: v }))} />
				<Field label="Price (paise)" id="p-price" value={form.price_paise} onChange={(v) => setForm((f) => ({ ...f, price_paise: v }))} />
				<Field
					label="Tests / period"
					id="p-tests"
					value={form.tests_per_period}
					onChange={(v) => setForm((f) => ({ ...f, tests_per_period: v }))}
				/>
				<Field
					label="Tokens 6–10"
					id="p-t6"
					value={form.tokens_grade_6_10}
					onChange={(v) => setForm((f) => ({ ...f, tokens_grade_6_10: v }))}
				/>
				<Field
					label="Tokens 11–12"
					id="p-t11"
					value={form.tokens_grade_11_12}
					onChange={(v) => setForm((f) => ({ ...f, tokens_grade_11_12: v }))}
				/>
				<Field
					label="Pool multiplier"
					id="p-pool"
					value={form.pool_multiplier}
					onChange={(v) => setForm((f) => ({ ...f, pool_multiplier: v }))}
				/>
				<Field label="Sort order" id="p-sort" value={form.sort_order} onChange={(v) => setForm((f) => ({ ...f, sort_order: v }))} />
			</div>
			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={form.is_active}
					onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
				/>
				Active
			</label>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					disabled={busy !== null}
					onClick={async () => {
						setBusy("save");
						try {
							await patch();
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					{busy === "save" ? "Saving…" : "Save changes"}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={busy !== null || !initial.razorpay_plan_id}
					title={!initial.razorpay_plan_id ? "No Razorpay plan id" : undefined}
					onClick={async () => {
						setBusy("sync");
						try {
							const res = await fetch(`/api/admin/plans/${encodeURIComponent(initial.code)}/sync-razorpay`, {
								method: "POST",
								credentials: "include",
							});
							const j = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string; detail?: string };
							if (!res.ok) throw new Error(j.detail ?? j.error ?? res.statusText);
							alert(JSON.stringify(j.data, null, 2));
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					{busy === "sync" ? "Checking…" : "Sync with Razorpay (read-only)"}
				</Button>
			</div>
		</div>
	);
}

function Field({
	label,
	id,
	value,
	onChange,
}: {
	label: string;
	id: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={id} className="text-xs font-medium text-muted-foreground">
				{label}
			</label>
			<Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
		</div>
	);
}
