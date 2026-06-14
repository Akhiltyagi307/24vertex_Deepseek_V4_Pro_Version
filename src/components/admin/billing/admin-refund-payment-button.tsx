"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
	paymentId: string;
	amountPaise: number;
	refundedAt: string | null;
	razorpayPaymentId: string | null;
	totpRequired: boolean;
};

export function AdminRefundPaymentButton({ paymentId, amountPaise, refundedAt, razorpayPaymentId, totpRequired }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [partialPaise, setPartialPaise] = useState("");
	const [totp, setTotp] = useState("");

	if (refundedAt || !razorpayPaymentId) {
		return (
			<p className="text-sm text-muted-foreground">
				{!razorpayPaymentId ? "No Razorpay payment id; refund unavailable." : "Already refunded."}
			</p>
		);
	}

	const totpValid = !totpRequired || /^\d{6}$/.test(totp.trim());

	return (
		<div className="space-y-2 rounded-lg border border-border p-4">
			<h3 className="text-sm font-semibold">Refund</h3>
			<p className="text-sm text-muted-foreground">
				Uses Razorpay refund API. Leave amount empty for full refund ({amountPaise} paise).
			</p>
			<div className="flex max-w-xs flex-col gap-1">
				<label className="text-xs font-medium text-muted-foreground" htmlFor="refund-partial">
					Partial amount (paise), optional
				</label>
				<Input
					id="refund-partial"
					inputMode="numeric"
					placeholder={`Full: ${amountPaise}`}
					value={partialPaise}
					onChange={(e) => setPartialPaise(e.target.value.replace(/\D/g, ""))}
				/>
			</div>
			{totpRequired ?
				<div className="flex max-w-xs flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="refund-totp">
						TOTP code
					</label>
					<Input
						id="refund-totp"
						inputMode="numeric"
						autoComplete="one-time-code"
						placeholder="000000"
						value={totp}
						onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
					/>
				</div>
			:	null}
			<Button
				type="button"
				variant="destructive"
				size="sm"
				disabled={busy || !totpValid}
				onClick={async () => {
					if (!confirm("Submit refund to Razorpay? This cannot be undone from this panel.")) return;
					const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
					const body: { amount_paise?: number; totp?: string } = {};
					const n = partialPaise.trim() ? Number(partialPaise) : NaN;
					if (Number.isFinite(n) && n > 0) body.amount_paise = n;
					if (totpRequired) body.totp = totp.trim();
					setBusy(true);
					try {
						const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
							method: "POST",
							credentials: "include",
							headers: {
								"Content-Type": "application/json",
								"Idempotency-Key": idempotencyKey,
							},
							body: JSON.stringify(body),
						});
						const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string; deduped?: boolean };
						if (!res.ok) throw new Error(j.detail ?? j.error ?? res.statusText);
						if (j.deduped) alert("Idempotent replay: refund already recorded for this key.");
						router.refresh();
					} catch (e) {
						alert(e instanceof Error ? e.message : "Failed");
					} finally {
						setBusy(false);
					}
				}}
			>
				{busy ? "Submitting…" : "Refund via Razorpay"}
			</Button>
		</div>
	);
}
