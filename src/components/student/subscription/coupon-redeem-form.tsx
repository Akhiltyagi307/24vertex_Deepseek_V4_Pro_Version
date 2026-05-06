"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	redeemCoupon,
	type StagedCheckoutCoupon,
} from "../../../../app/student/subscription/actions";

type Props = {
	billingProfileId?: string;
	/**
	 * When provided, a `checkout_discount` coupon is staged on the page (the parent
	 * component shows it as a chip and forwards the code to Razorpay at upgrade time)
	 * instead of being treated as an error. Omit on pages without a plan picker
	 * (e.g. the parent portal) — the form will then point the user to the student
	 * page for paid-checkout coupons.
	 */
	onCheckoutDiscountStaged?: (staged: StagedCheckoutCoupon) => void;
};

export function CouponRedeemForm({ billingProfileId, onCheckoutDiscountStaged }: Props) {
	const [code, setCode] = React.useState("");
	const [pending, startTransition] = React.useTransition();
	const router = useRouter();

	function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const trimmed = code.trim();
		if (!trimmed) return;
		startTransition(async () => {
			const res = await redeemCoupon(trimmed, billingProfileId);
			if (!res.ok) {
				toast.error(res.message);
				return;
			}
			if (res.kind === "checkout_discount") {
				if (onCheckoutDiscountStaged) {
					onCheckoutDiscountStaged({
						couponCode: res.couponCode,
						discountPercent: res.discountPercent,
						eligiblePlanCodes: res.eligiblePlanCodes,
					});
					toast.success(res.message);
					setCode("");
				} else {
					toast.info(
						"This is a checkout coupon — apply it on the student's subscription page when picking a paid plan.",
					);
				}
				return;
			}
			toast.success(res.message);
			setCode("");
			router.refresh();
		});
	}

	return (
		<form onSubmit={onSubmit} aria-label="Redeem coupon">
			<label htmlFor="coupon-code" className="sr-only">
				Coupon code
			</label>
			<div className="flex items-center gap-1 rounded-lg border bg-background p-1 pl-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
				<input
					id="coupon-code"
					type="text"
					value={code}
					onChange={(e) => setCode(e.target.value.toUpperCase())}
					placeholder="ENTER COUPON CODE"
					aria-label="Coupon code"
					maxLength={40}
					autoComplete="off"
					spellCheck={false}
					className="flex-1 min-w-0 border-0 bg-transparent font-mono text-sm uppercase tracking-wider placeholder:text-muted-foreground/60 placeholder:font-normal focus:outline-none"
				/>
				<Button
					type="submit"
					size="sm"
					variant="ghost"
					disabled={pending || code.trim().length === 0}
				>
					{pending ? "Applying…" : "Apply"}
				</Button>
			</div>
		</form>
	);
}
