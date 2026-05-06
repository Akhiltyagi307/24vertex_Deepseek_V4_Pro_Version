"use client";

import * as React from "react";
import { TicketIcon, XIcon } from "lucide-react";

import { BillingTrustRow } from "@/components/student/subscription/billing-trust-row";
import { CouponRedeemForm } from "@/components/student/subscription/coupon-redeem-form";
import { PlanComparison } from "@/components/student/subscription/plan-comparison";
import { PlanComparisonTable } from "@/components/student/subscription/plan-comparison-table";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { StagedCheckoutCoupon } from "@/app/student/subscription/actions";
import type { PLAN_CATALOG, PlanCode } from "@/lib/billing/plans";

type Props = {
	currentPlanCode: PlanCode;
	isTrialing: boolean;
	trialEndsAt: string | null;
	trialDaysLeft: number | null;
	grade: number | null;
	prefill?: { name?: string; email?: string; contact?: string };
	planCatalog: typeof PLAN_CATALOG;
	billingProfileId?: string;
	isPaid: boolean;
};

export function PlansWithCouponSection({
	currentPlanCode,
	isTrialing,
	trialEndsAt,
	trialDaysLeft,
	grade,
	prefill,
	planCatalog,
	billingProfileId,
	isPaid,
}: Props) {
	const [staged, setStaged] = React.useState<StagedCheckoutCoupon | null>(null);

	return (
		<section id="plans" className="flex flex-col gap-4">
			<div>
				<h2 className="font-heading text-lg font-medium tracking-tight">Choose a plan</h2>
				<p className="text-pretty text-sm text-muted-foreground">
					Pick what fits how often you&apos;ll practice and use the AI tutor. Paid plans use Razorpay with UPI
					Autopay or card; checkout is secure, and you can cancel from this page.
				</p>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<TicketIcon className="size-4 text-muted-foreground" aria-hidden />
						<CardTitle className="text-base">Have a coupon?</CardTitle>
					</div>
					<CardDescription className="text-pretty">
						Enter a code from school, a campaign, or a promo. Free-month codes apply right away; percentage-off
						codes apply when you pick a plan below.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<CouponRedeemForm
						billingProfileId={billingProfileId}
						onCheckoutDiscountStaged={setStaged}
					/>
					{staged ? (
						<div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.06] px-3 py-2 text-sm">
							<span className="font-mono text-xs font-medium uppercase tracking-wider text-primary">
								{staged.couponCode}
							</span>
							<span className="text-muted-foreground">
								— {staged.discountPercent}% off
								{staged.eligiblePlanCodes && staged.eligiblePlanCodes.length > 0
									? ` on ${staged.eligiblePlanCodes
											.map((code) => planCatalog[code]?.name ?? code)
											.join(", ")}`
									: " on any paid plan"}
								. Applies when you upgrade.
							</span>
							<button
								type="button"
								onClick={() => setStaged(null)}
								className="ml-auto inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground"
								aria-label="Clear staged coupon"
							>
								<XIcon className="size-3.5" aria-hidden />
								Clear
							</button>
						</div>
					) : null}
					{isPaid ? (
						<p className="text-xs text-muted-foreground">
							You&apos;re already on a paid plan, so a coupon can&apos;t be added on top right now.
						</p>
					) : null}
				</CardContent>
			</Card>

			<PlanComparison
				currentPlanCode={currentPlanCode}
				isTrialing={isTrialing}
				trialEndsAt={trialEndsAt}
				trialDaysLeft={trialDaysLeft}
				grade={grade}
				prefill={prefill}
				planCatalog={planCatalog}
				billingProfileId={billingProfileId}
				stagedCheckoutCoupon={staged}
			/>
			<PlanComparisonTable
				currentPlanCode={currentPlanCode}
				grade={grade}
				planCatalog={planCatalog}
			/>
			<BillingTrustRow />
		</section>
	);
}
