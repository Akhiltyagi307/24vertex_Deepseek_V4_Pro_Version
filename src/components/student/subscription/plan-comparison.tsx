"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { RazorpayCheckoutButton } from "@/components/student/subscription/razorpay-checkout";
import { PriceDisplay } from "@/components/student/subscription/price-display";
import type { StagedCheckoutCoupon } from "@/app/student/subscription/actions";
import { PLAN_CATALOG, type PlanCode } from "@/lib/billing/plans";
import { formatDateShortDMYInAppTimeZone } from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";

type Props = {
	currentPlanCode: PlanCode;
	isTrialing: boolean;
	trialEndsAt: string | null;
	trialDaysLeft: number | null;
	grade: number | null;
	prefill?: { name?: string; email?: string; contact?: string };
	/** When set (e.g. from server `getCachedPlanCatalog`), avoids duplicate static catalog reads. */
	planCatalog?: typeof PLAN_CATALOG;
	/** Parent pays for a linked student's subscription. */
	billingProfileId?: string;
	/**
	 * A `checkout_discount` coupon the user staged via the unified coupon form.
	 * When set and the plan is eligible, the card renders a discounted price and
	 * forwards the code to Razorpay at checkout.
	 */
	stagedCheckoutCoupon?: StagedCheckoutCoupon | null;
};

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)} M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)} k`;
	return n.toLocaleString("en-IN");
}

function formatBillingStart(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	const s = formatDateShortDMYInAppTimeZone(iso);
	return s === "—" ? null : s;
}

function isEligibleForStagedCoupon(
	planCode: PlanCode,
	staged: StagedCheckoutCoupon | null | undefined,
): boolean {
	if (!staged) return false;
	if (!staged.eligiblePlanCodes) return true;
	return staged.eligiblePlanCodes.includes(planCode);
}

function applyDiscount(amountPaise: number, discountPercent: number): number {
	const discounted = amountPaise * (1 - discountPercent / 100);
	return Math.max(0, Math.round(discounted));
}

type PlanCardModel = {
	code: PlanCode;
	title: string;
	subtitle: string;
	amountPaise: number;
	period: "month" | "year";
	compareAtPaise?: number;
	bullets: string[];
	elevated?: boolean;
	action: React.ReactNode;
};

export function PlanComparison({
	currentPlanCode,
	isTrialing,
	trialEndsAt,
	trialDaysLeft,
	grade,
	prefill,
	planCatalog = PLAN_CATALOG,
	billingProfileId,
	stagedCheckoutCoupon,
}: Props) {
	const monthly = planCatalog.pro_monthly;
	const annual = planCatalog.pro_annual;
	const isSenior = grade != null && grade >= 11;
	const billingStart = formatBillingStart(trialEndsAt);

	const monthlyLabel =
		currentPlanCode === "pro_monthly"
			? "Manage on Razorpay"
			: isTrialing
				? billingStart
					? `Start Pro: billing begins ${billingStart}`
					: "Start Pro after trial"
				: "Upgrade to Pro Monthly";

	const annualLabel =
		currentPlanCode === "pro_annual" ? "Manage on Razorpay" : "Upgrade to Pro Annual";

	const monthlyHasDiscount = isEligibleForStagedCoupon("pro_monthly", stagedCheckoutCoupon);
	const annualHasDiscount = isEligibleForStagedCoupon("pro_annual", stagedCheckoutCoupon);

	const monthlyAmount = monthlyHasDiscount && stagedCheckoutCoupon
		? applyDiscount(monthly.pricePaise, stagedCheckoutCoupon.discountPercent)
		: monthly.pricePaise;
	const annualAmount = annualHasDiscount && stagedCheckoutCoupon
		? applyDiscount(annual.pricePaise, stagedCheckoutCoupon.discountPercent)
		: annual.pricePaise;

	const cards: PlanCardModel[] = [
		{
			code: "pro_monthly",
			title: monthly.name,
			subtitle: `${monthly.testsPerPeriod} tests · ${formatTokens(
				isSenior ? monthly.tokensGrade11to12 : monthly.tokensGrade6to10,
			)} AI output tokens / month`,
			amountPaise: monthlyAmount,
			period: "month",
			compareAtPaise: monthlyHasDiscount ? monthly.pricePaise : undefined,
			bullets: [
				`${monthly.testsPerPeriod} practice tests / month`,
				`${formatTokens(isSenior ? monthly.tokensGrade11to12 : monthly.tokensGrade6to10)} AI output tokens / month (doubt chat)`,
				"Priority doubt-chat access",
				"Cancel anytime",
			],
			elevated: true,
			action: (
				<RazorpayCheckoutButton
					planCode="pro_monthly"
					label={monthlyLabel}
					startMode={isTrialing ? "after_trial" : "immediate"}
					prefill={prefill}
					className="w-full"
					disabled={currentPlanCode === "pro_monthly"}
					billingProfileId={billingProfileId}
					checkoutCouponCode={monthlyHasDiscount ? stagedCheckoutCoupon?.couponCode : undefined}
				/>
			),
		},
		{
			code: "pro_annual",
			title: annual.name,
			subtitle: `Save ≈${annual.annualSavingsPercent ?? 17}% · 12-month pool`,
			amountPaise: annualAmount,
			period: "year",
			compareAtPaise: annualHasDiscount ? annual.pricePaise : monthly.pricePaise * 12,
			bullets: [
				`${annual.testsPerPeriod} tests / year (burn at any pace)`,
				`${formatTokens(isSenior ? annual.tokensGrade11to12 : annual.tokensGrade6to10)} AI output tokens / year (doubt chat)`,
				"Billed once a year",
				"Cancel anytime; you keep access until period end",
			],
			action: (
				<RazorpayCheckoutButton
					planCode="pro_annual"
					label={annualLabel}
					startMode={isTrialing ? "after_trial" : "immediate"}
					variant="outline"
					prefill={prefill}
					className="w-full"
					disabled={currentPlanCode === "pro_annual"}
					billingProfileId={billingProfileId}
					checkoutCouponCode={annualHasDiscount ? stagedCheckoutCoupon?.couponCode : undefined}
				/>
			),
		},
	];

	return (
		<div className="grid gap-4 medium:grid-cols-2 medium:gap-5">
			{cards.map((c) => {
				const isCurrent = currentPlanCode === c.code;
				return (
					<Card
						key={c.code}
						className={cn(
							"relative h-full transition-[transform,box-shadow] duration-200 ease-out",
							c.elevated
								? "shadow-sm medium:shadow-md ring-1 ring-primary/30 medium:-translate-y-1"
								: "",
							isCurrent ? "ring-2 ring-primary" : "",
						)}
					>
						{c.elevated && !isCurrent ? (
							<div className="absolute top-3 right-3 z-10 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
								Most popular
							</div>
						) : null}
						<CardHeader
							className={cn(
								"gap-2",
								c.elevated && !isCurrent ? "pr-24 medium:pr-28" : "",
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<CardTitle className="text-base">{c.title}</CardTitle>
								{isCurrent ? (
									<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
										<span
											aria-hidden
											className="inline-block size-1.5 rounded-full bg-primary"
										/>
										Current plan
										{isTrialing && trialDaysLeft != null
											? ` · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
											: ""}
									</span>
								) : null}
							</div>
							<CardDescription>{c.subtitle}</CardDescription>
							<div className="mt-1">
								<PriceDisplay
									amountPaise={c.amountPaise}
									period={c.period}
									compareAtPaise={c.compareAtPaise}
								/>
							</div>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col gap-4">
							<ul className="flex flex-col gap-2">
								{c.bullets.map((b) => (
									<li key={b} className="flex items-start gap-2 text-sm">
										<CheckIcon
											className={cn(
												"mt-0.5 size-4 shrink-0",
												isCurrent ? "text-primary" : "text-muted-foreground/70",
											)}
											aria-hidden
										/>
										<span>{b}</span>
									</li>
								))}
							</ul>
							<div className="mt-auto">{c.action}</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
