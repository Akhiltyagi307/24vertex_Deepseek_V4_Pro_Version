"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { SUBSCRIPTION_STATUSES } from "@/lib/billing/subscription-admin-transitions";

type Props = {
	subscriptionId: string;
	cancelAtPeriodEnd: boolean;
	razorpayLinked: boolean;
	staffOverride: boolean;
	currentStatus: string;
};

export function AdminSubscriptionActions({
	subscriptionId,
	cancelAtPeriodEnd,
	razorpayLinked,
	staffOverride,
	currentStatus,
}: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [flipTarget, setFlipTarget] = useState(currentStatus);
	const [couponCode, setCouponCode] = useState("");
	useEffect(() => {
		setFlipTarget(currentStatus);
	}, [currentStatus]);

	const post = async (path: string, body?: object) => {
		const res = await fetch(path, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		});
		const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
		if (!res.ok) throw new Error(j.detail ?? j.error ?? res.statusText);
	};

	return (
		<div className="space-y-6 rounded-lg border border-border p-4">
			<div>
				<h3 className="text-sm font-semibold">Cancel at period end</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					{razorpayLinked ?
						"Schedules cancellation in Razorpay at the end of the current billing cycle and marks this row."
					:	"Sets the local flag only (no Razorpay subscription on file)."}
				</p>
				<div className="mt-2 flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={busy !== null || cancelAtPeriodEnd}
						onClick={async () => {
							if (!confirm("Schedule cancellation at the end of the current period?")) return;
							setBusy("cancel");
							try {
								await post(`/api/admin/subscriptions/${subscriptionId}/cancel-at-period-end`);
								router.refresh();
							} catch (e) {
								alert(e instanceof Error ? e.message : "Failed");
							} finally {
								setBusy(null);
							}
						}}
					>
						Schedule cancel…
					</Button>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						disabled={busy !== null || !cancelAtPeriodEnd || razorpayLinked}
						title={
							razorpayLinked ?
								"Use Razorpay dashboard to resume a linked subscription, then refresh."
							:	undefined
						}
						onClick={async () => {
							if (!confirm("Clear scheduled cancellation for this offline subscription?")) return;
							setBusy("clear");
							try {
								await post(`/api/admin/subscriptions/${subscriptionId}/clear-cancel-at-period-end`);
								router.refresh();
							} catch (e) {
								alert(e instanceof Error ? e.message : "Failed");
							} finally {
								setBusy(null);
							}
						}}
					>
						Clear scheduled cancel
					</Button>
				</div>
			</div>
			<div>
				<h3 className="text-sm font-semibold">Cancel immediately</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Cancels in Razorpay when linked, then sets status to <span className="font-mono">cancelled</span>.
				</p>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					className="mt-2"
					disabled={busy !== null || currentStatus === "cancelled"}
					onClick={async () => {
						if (!confirm("Cancel this subscription immediately? This is irreversible in Razorpay when linked.")) return;
						setBusy("cancel_now");
						try {
							await post(`/api/admin/subscriptions/${subscriptionId}/cancel-now`);
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					Cancel now…
				</Button>
			</div>

			{!razorpayLinked ?
				<div>
					<h3 className="text-sm font-semibold">Offline status flip</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Only for subscriptions without Razorpay. Allowed transitions are enforced server-side.
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<select
							className="h-9 rounded-md border border-input bg-background px-2 text-sm"
							value={flipTarget}
							onChange={(e) => setFlipTarget(e.target.value)}
						>
							{SUBSCRIPTION_STATUSES.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={busy !== null || flipTarget === currentStatus}
							onClick={async () => {
								if (!confirm(`Set status to ${flipTarget}?`)) return;
								setBusy("flip");
								try {
									await post(`/api/admin/subscriptions/${subscriptionId}/flip-status`, {
										target_status: flipTarget,
									});
									router.refresh();
								} catch (e) {
									alert(e instanceof Error ? e.message : "Failed");
								} finally {
									setBusy(null);
								}
							}}
						>
							Apply status
						</Button>
					</div>
				</div>
			:	null}

			<div>
				<h3 className="text-sm font-semibold">Apply coupon</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Uses the same <span className="font-mono">billing_redeem_coupon_atomic</span> RPC as the student portal. Blocked when subscription is in paid active states.
				</p>
				<div className="mt-2 flex max-w-md flex-wrap items-center gap-2">
					<Input
						className="h-9 max-w-xs font-mono"
						placeholder="COUPON-CODE"
						value={couponCode}
						onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
					/>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={busy !== null || !couponCode.trim()}
						onClick={async () => {
							if (!confirm(`Redeem coupon ${couponCode.trim()} for this subscription's student?`)) return;
							setBusy("coupon");
							try {
								await post(`/api/admin/subscriptions/${subscriptionId}/apply-coupon`, {
									coupon_code: couponCode.trim(),
								});
								setCouponCode("");
								router.refresh();
							} catch (e) {
								alert(e instanceof Error ? e.message : "Failed");
							} finally {
								setBusy(null);
							}
						}}
					>
						Apply
					</Button>
				</div>
			</div>

			<div>
				<h3 className="text-sm font-semibold">Force renew (extend period)</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Pushes <span className="font-mono">current_period_end</span> by one plan interval (or Razorpay break-glass if{" "}
					<span className="font-mono">ADMIN_BILLING_FORCE_RENEW_RZP=1</span>).
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-2"
					disabled={busy !== null}
					onClick={async () => {
						if (!confirm("Extend billing period end for this subscription?")) return;
						setBusy("renew");
						try {
							await post(`/api/admin/subscriptions/${subscriptionId}/force-renew`, {});
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					Force renew…
				</Button>
			</div>

			<div>
				<h3 className="text-sm font-semibold">Recompute usage quotas</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Re-reads <span className="font-mono">plans</span> tests/tokens for the current usage period without resetting usage counters.
				</p>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="mt-2"
					disabled={busy !== null}
					onClick={async () => {
						if (!confirm("Recompute tests/tokens quota columns for the active usage period?")) return;
						setBusy("recompute");
						try {
							const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/recompute-usage`, {
								method: "POST",
								credentials: "include",
							});
							const j = (await res.json().catch(() => ({}))) as { error?: string };
							if (!res.ok) throw new Error(j.error ?? res.statusText);
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					Recompute usage
				</Button>
			</div>

			<div>
				<h3 className="text-sm font-semibold">Staff override</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Marks the subscription for operator bypass rules (see billing code). Toggle only when you understand downstream effects.
				</p>
				<Button
					type="button"
					variant={staffOverride ? "secondary" : "outline"}
					size="sm"
					className="mt-2"
					disabled={busy !== null}
					onClick={async () => {
						setBusy("staff");
						try {
							await post(`/api/admin/subscriptions/${subscriptionId}/staff-override`, {
								staff_override: !staffOverride,
							});
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					{staffOverride ? "Turn staff override off" : "Turn staff override on"}
				</Button>
			</div>
		</div>
	);
}
