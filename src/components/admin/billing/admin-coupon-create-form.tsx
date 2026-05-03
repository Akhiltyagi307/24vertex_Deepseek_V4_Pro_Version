"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminCouponCreateForm() {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [planCodes, setPlanCodes] = useState<string[]>([]);
	const [kind, setKind] = useState<"entitlement" | "checkout_discount">("entitlement");
	const [code, setCode] = useState("");
	const [grantsPlanCode, setGrantsPlanCode] = useState("");
	const [maxRedemptions, setMaxRedemptions] = useState("100");
	const [durationDays, setDurationDays] = useState("30");
	const [description, setDescription] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [singleUseGlobally, setSingleUseGlobally] = useState(false);
	const [discountPercent, setDiscountPercent] = useState("10");

	useEffect(() => {
		void (async () => {
			const res = await fetch("/api/admin/plans", { credentials: "include" });
			const j = (await res.json()) as { data?: { code: string }[] };
			if (res.ok && j.data?.length) {
				setPlanCodes(j.data.map((p) => p.code));
				setGrantsPlanCode((c) => c || j.data![0]!.code);
			}
		})();
	}, []);

	return (
		<form
			className="max-w-xl space-y-4 rounded-lg border border-border p-4"
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				try {
					const base = {
						code: code.trim(),
						max_redemptions: Number(maxRedemptions),
						description: description.trim() || null,
						...(expiresAt.trim() ? { expires_at: new Date(expiresAt).toISOString() } : { expires_at: null }),
					};
					const body =
						kind === "entitlement"
							? {
									...base,
									kind: "entitlement" as const,
									grants_plan_code: grantsPlanCode,
									duration_days: Number(durationDays),
									single_use_globally: singleUseGlobally,
								}
							: {
									...base,
									kind: "checkout_discount" as const,
									discount_percent: Number(discountPercent),
									duration_days: 0,
									eligible_plan_codes: null,
								};
					const res = await fetch("/api/admin/coupons", {
						method: "POST",
						credentials: "include",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body),
					});
					const j = (await res.json().catch(() => ({}))) as {
						data?: { code: string };
						error?: string | { formErrors?: string[] };
					};
					if (!res.ok) {
						const err = j.error;
						throw new Error(typeof err === "string" ? err : JSON.stringify(err));
					}
					const created = j.data?.code;
					if (created) router.push(`/admin/billing/coupons/${encodeURIComponent(created)}`);
					else router.push("/admin/billing/coupons");
				} catch (err) {
					alert(err instanceof Error ? err.message : "Failed");
				} finally {
					setBusy(false);
				}
			}}
		>
			<div className="flex flex-col gap-1">
				<span className="text-xs font-medium text-muted-foreground">Coupon type</span>
				<div className="flex flex-wrap gap-3 text-sm">
					<label className="flex items-center gap-2">
						<input type="radio" name="kind" checked={kind === "entitlement"} onChange={() => setKind("entitlement")} />
						Free access (entitlement)
					</label>
					<label className="flex items-center gap-2">
						<input type="radio" name="kind" checked={kind === "checkout_discount"} onChange={() => setKind("checkout_discount")} />
						% off Razorpay checkout
					</label>
				</div>
				<p className="text-xs text-muted-foreground">
					Entitlement grants days of a plan without payment. Checkout applies a Razorpay subscription offer when the student
					subscribes.
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="flex flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="cc-code">
						Code
					</label>
					<Input id="cc-code" className="h-9 font-mono" value={code} onChange={(e) => setCode(e.target.value)} required />
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="cc-max">
						Max redemptions
					</label>
					<Input
						id="cc-max"
						className="h-9"
						inputMode="numeric"
						value={maxRedemptions}
						onChange={(e) => setMaxRedemptions(e.target.value.replace(/\D/g, ""))}
						required
					/>
				</div>

				{kind === "entitlement" ? (
					<>
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground" htmlFor="cc-plan">
								Grants plan
							</label>
							<select
								id="cc-plan"
								className="h-9 rounded-md border border-input bg-background px-2 text-sm"
								value={grantsPlanCode}
								onChange={(e) => setGrantsPlanCode(e.target.value)}
								required
							>
								{planCodes.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground" htmlFor="cc-dur">
								Duration (days)
							</label>
							<Input
								id="cc-dur"
								className="h-9"
								inputMode="numeric"
								value={durationDays}
								onChange={(e) => setDurationDays(e.target.value.replace(/\D/g, ""))}
								required
							/>
						</div>
						<div className="flex flex-col gap-1 sm:col-span-2">
							<label className="flex items-center gap-2 text-sm">
								<input type="checkbox" checked={singleUseGlobally} onChange={(e) => setSingleUseGlobally(e.target.checked)} />
								Strict: only one redemption total (globally), regardless of max redemptions
							</label>
						</div>
					</>
				) : (
					<>
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground" htmlFor="cc-pct">
								Discount (%)
							</label>
							<Input
								id="cc-pct"
								className="h-9"
								inputMode="numeric"
								value={discountPercent}
								onChange={(e) => setDiscountPercent(e.target.value.replace(/\D/g, ""))}
								required
							/>
						</div>
					</>
				)}

				<div className="flex flex-col gap-1 sm:col-span-2">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="cc-exp">
						Expires (optional)
					</label>
					<Input id="cc-exp" className="h-9 w-56" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
				</div>
			</div>
			<div className="flex flex-col gap-1">
				<label className="text-xs font-medium text-muted-foreground" htmlFor="cc-desc">
					Description
				</label>
				<Input id="cc-desc" className="h-9" value={description} onChange={(e) => setDescription(e.target.value)} />
			</div>
			<Button type="submit" disabled={busy || !code.trim() || (kind === "entitlement" && !grantsPlanCode)}>
				{busy ? "Creating…" : "Create coupon"}
			</Button>
		</form>
	);
}
