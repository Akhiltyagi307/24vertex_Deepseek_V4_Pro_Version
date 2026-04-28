"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { redeemCoupon } from "../../../../app/student/subscription/actions";

export function CouponRedeemForm({ billingProfileId }: { billingProfileId?: string }) {
	const [code, setCode] = React.useState("");
	const [pending, startTransition] = React.useTransition();
	const router = useRouter();

	function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const trimmed = code.trim();
		if (!trimmed) return;
		startTransition(async () => {
			const res = await redeemCoupon(trimmed, billingProfileId);
			if (res.ok) {
				toast.success(res.message);
				setCode("");
				router.refresh();
			} else {
				toast.error(res.message);
			}
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
					{pending ? "Applying\u2026" : "Apply"}
				</Button>
			</div>
		</form>
	);
}
