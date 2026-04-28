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
import { PLAN_CATALOG, type PlanCode } from "@/lib/billing/plans";
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
};

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}\u00A0M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}\u00A0k`;
	return n.toLocaleString("en-IN");
}

function formatBillingStart(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
					? `Start Pro \u2014 billing begins ${billingStart}`
					: "Start Pro after trial"
				: "Upgrade to Pro Monthly";

	const annualLabel =
		currentPlanCode === "pro_annual" ? "Manage on Razorpay" : "Upgrade to Pro Annual";

	const cards: PlanCardModel[] = [
		{
			code: "pro_monthly",
			title: monthly.name,
			subtitle: `${monthly.testsPerPeriod} tests \u00B7 ${formatTokens(
				isSenior ? monthly.tokensGrade11to12 : monthly.tokensGrade6to10,
			)} AI output tokens / month`,
			amountPaise: monthly.pricePaise,
			period: "month",
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
				/>
			),
		},
		{
			code: "pro_annual",
			title: annual.name,
			subtitle: `Save \u2248${annual.annualSavingsPercent ?? 17}% \u00B7 12-month pool`,
			amountPaise: annual.pricePaise,
			period: "year",
			compareAtPaise: monthly.pricePaise * 12,
			bullets: [
				`${annual.testsPerPeriod} tests / year (burn at any pace)`,
				`${formatTokens(isSenior ? annual.tokensGrade11to12 : annual.tokensGrade6to10)} AI output tokens / year (doubt chat)`,
				"Billed once a year",
				"Cancel anytime \u2014 keep access until period end",
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
				/>
			),
		},
	];

	return (
		<div className="grid gap-4 md:grid-cols-2 md:gap-5">
			{cards.map((c) => {
				const isCurrent = currentPlanCode === c.code;
				return (
					<Card
						key={c.code}
						className={cn(
							"relative h-full transition-[transform,box-shadow] duration-200",
							c.elevated
								? "shadow-sm md:shadow-md ring-1 ring-primary/30 md:-translate-y-1"
								: "",
							isCurrent ? "ring-2 ring-primary" : "",
						)}
					>
						{c.elevated && !isCurrent ? (
							<div className="absolute top-3 right-3 z-10 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
								Most popular
							</div>
						) : null}
						<CardHeader className="gap-2">
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
											? ` \u00B7 ${trialDaysLeft}\u00A0day${trialDaysLeft === 1 ? "" : "s"} left`
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
