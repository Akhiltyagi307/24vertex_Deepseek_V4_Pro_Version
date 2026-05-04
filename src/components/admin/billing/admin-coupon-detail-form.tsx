"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CouponDetailInitial = {
	code: string;
	kind: string;
	description: string | null;
	max_redemptions: number;
	redemptions_count: number;
	duration_days: number;
	is_active: boolean;
	expires_at: string | null;
	single_use_globally?: boolean;
	discount_percent?: number | null;
	eligible_plan_codes?: string[] | null;
	razorpay_offers_by_plan?: Record<string, string> | null;
};

type Props = { initial: CouponDetailInitial };

export function AdminCouponDetailForm({ initial }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [description, setDescription] = useState(initial.description ?? "");
	const [maxRedemptions, setMaxRedemptions] = useState(String(initial.max_redemptions));
	const [durationDays, setDurationDays] = useState(String(initial.duration_days));
	const [isActive, setIsActive] = useState(initial.is_active);
	const [expiresAt, setExpiresAt] = useState(
		initial.expires_at ? new Date(initial.expires_at).toISOString().slice(0, 16) : "",
	);
	const [singleUseGlobally, setSingleUseGlobally] = useState(Boolean(initial.single_use_globally));
	const [discountPercent, setDiscountPercent] = useState(String(initial.discount_percent ?? ""));
	const [elMonthly, setElMonthly] = useState(
		!initial.eligible_plan_codes?.length || initial.eligible_plan_codes.includes("pro_monthly"),
	);
	const [elAnnual, setElAnnual] = useState(
		!initial.eligible_plan_codes?.length || initial.eligible_plan_codes.includes("pro_annual"),
	);

	const codeEnc = encodeURIComponent(initial.code);
	const isCheckout = initial.kind === "checkout_discount";

	const patch = async () => {
		if (isCheckout && !elMonthly && !elAnnual) {
			throw new Error("Select at least one eligible plan (monthly and/or annual).");
		}
		const body: Record<string, unknown> = {
			description: description.trim() || null,
			max_redemptions: Number(maxRedemptions),
			duration_days: Number(durationDays),
			is_active: isActive,
		};
		if (expiresAt.trim()) body.expires_at = new Date(expiresAt).toISOString();
		else body.expires_at = null;

		if (!isCheckout) {
			body.single_use_globally = singleUseGlobally;
		} else {
			const pct = Number(discountPercent);
			if (pct >= 1 && pct <= 100) body.discount_percent = pct;
			const elig: ("pro_monthly" | "pro_annual")[] = [];
			if (elMonthly) elig.push("pro_monthly");
			if (elAnnual) elig.push("pro_annual");
			body.eligible_plan_codes = elig.length === 2 ? null : elig.length ? elig : null;
		}

		const res = await fetch(`/api/admin/coupons/${codeEnc}`, {
			method: "PATCH",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const j = (await res.json().catch(() => ({}))) as { error?: unknown };
		if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : res.statusText);
	};

	return (
		<div className="max-w-xl space-y-4 rounded-lg border border-border p-4">
			<h3 className="text-sm font-semibold">Edit coupon</h3>
			<p className="font-mono text-xs text-muted-foreground">{initial.code}</p>
			<p className="text-xs text-muted-foreground">
				Type: <span className="font-medium text-foreground">{initial.kind}</span>
			</p>
			<p className="text-sm text-muted-foreground">Redemptions: {initial.redemptions_count}</p>

			{isCheckout && (
				<div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
					<p className="mb-2">
						Razorpay offer map:{" "}
						<code className="text-foreground">
							{JSON.stringify(initial.razorpay_offers_by_plan ?? {}) || "{}"}
						</code>
					</p>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						disabled={busy !== null}
						onClick={async () => {
							setBusy("sync");
							try {
								const res = await fetch(`/api/admin/coupons/${codeEnc}/sync-razorpay-offers`, {
									method: "POST",
									credentials: "include",
								});
								const j = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
								if (!res.ok) throw new Error(j.error ?? res.statusText);
								router.refresh();
							} catch (e) {
								alert(e instanceof Error ? e.message : "Sync failed");
							} finally {
								setBusy(null);
							}
						}}
					>
						{busy === "sync" ? "Syncing…" : "Sync Razorpay offers"}
					</Button>
				</div>
			)}

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="flex flex-col gap-1 sm:col-span-2">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="cd-desc">
						Description
					</label>
					<Input id="cd-desc" className="h-9" value={description} onChange={(e) => setDescription(e.target.value)} />
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="cd-max">
						Max redemptions
					</label>
					<Input
						id="cd-max"
						className="h-9"
						value={maxRedemptions}
						onChange={(e) => setMaxRedemptions(e.target.value.replace(/\D/g, ""))}
					/>
				</div>
				{isCheckout ? (
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-muted-foreground" htmlFor="cd-pct">
							Discount (%)
						</label>
						<Input
							id="cd-pct"
							className="h-9"
							value={discountPercent}
							onChange={(e) => setDiscountPercent(e.target.value.replace(/\D/g, ""))}
						/>
					</div>
				) : (
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-muted-foreground" htmlFor="cd-dur">
							Duration (days)
						</label>
						<Input
							id="cd-dur"
							className="h-9"
							value={durationDays}
							onChange={(e) => setDurationDays(e.target.value.replace(/\D/g, ""))}
						/>
					</div>
				)}
				<div className="flex flex-col gap-1 sm:col-span-2">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="cd-exp">
						Expires (optional)
					</label>
					<Input id="cd-exp" className="h-9 w-56" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
				</div>
				{isCheckout ? (
					<div className="flex flex-col gap-2 sm:col-span-2 text-sm">
						<span className="text-xs font-medium text-muted-foreground">Eligible paid plans</span>
						<label className="flex items-center gap-2">
							<input type="checkbox" checked={elMonthly} onChange={(e) => setElMonthly(e.target.checked)} />
							pro_monthly
						</label>
						<label className="flex items-center gap-2">
							<input type="checkbox" checked={elAnnual} onChange={(e) => setElAnnual(e.target.checked)} />
							pro_annual
						</label>
					</div>
				) : null}
				{!isCheckout ? (
					<div className="flex flex-col gap-1 sm:col-span-2">
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" checked={singleUseGlobally} onChange={(e) => setSingleUseGlobally(e.target.checked)} />
							Strict single redemption globally
						</label>
					</div>
				) : null}
			</div>
			<label className="flex items-center gap-2 text-sm">
				<input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
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
					{busy === "save" ? "Saving…" : "Save"}
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					disabled={busy !== null}
					onClick={async () => {
						if (!confirm("Disable this coupon?")) return;
						setBusy("dis");
						try {
							const res = await fetch(`/api/admin/coupons/${codeEnc}/disable`, {
								method: "POST",
								credentials: "include",
							});
							const j = (await res.json().catch(() => ({}))) as { error?: string };
							if (!res.ok) throw new Error(j.error ?? res.statusText);
							setIsActive(false);
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					Disable
				</Button>
			</div>
		</div>
	);
}
