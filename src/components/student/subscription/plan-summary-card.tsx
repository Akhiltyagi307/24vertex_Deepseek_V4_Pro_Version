import Link from "next/link";
import { ArrowRightIcon, CrownIcon, SparklesIcon } from "lucide-react";

import { RazorpayCheckoutButton } from "@/components/student/subscription/razorpay-checkout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { PLAN_CATALOG } from "@/lib/billing/plans";

type Variant = "compact" | "detail";

function formatStatusLabel(e: EntitlementSnapshot): string {
	if (e.staffOverride) return "Staff override";
	switch (e.status) {
		case "trialing": {
			const d = e.trialDaysLeft;
			if (d == null) return "Free trial";
			return d === 0 ? "Trial ending today" : `Trial, ${d}\u00A0day${d === 1 ? "" : "s"} left`;
		}
		case "active":
			return e.cancelAtPeriodEnd ? "Active (cancels at period end)" : "Active";
		case "coupon":
			return "Complimentary (coupon)";
		case "grace":
			return "Payment retrying; access preserved";
		case "past_due":
			return "Payment failed";
		case "cancelled":
			return "Cancelled";
		case "expired":
			return "Expired";
		default:
			return e.status;
	}
}

function statusTone(e: EntitlementSnapshot): "default" | "secondary" | "destructive" {
	if (e.status === "past_due" || e.status === "expired" || e.status === "cancelled") return "destructive";
	if (e.status === "trialing" && e.trialDaysLeft != null && e.trialDaysLeft <= 3) return "destructive";
	if (e.status === "active" || e.status === "coupon") return "default";
	return "secondary";
}

function formatRenewal(e: EntitlementSnapshot): string {
	const end = new Date(e.currentPeriodEnd);
	if (Number.isNaN(end.getTime())) return "";
	const formatted = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
	if (e.status === "trialing") return `Trial ends ${formatted}`;
	if (e.cancelAtPeriodEnd) return `Access ends ${formatted}`;
	if (e.status === "active") return `Renews ${formatted}`;
	if (e.status === "coupon") return `Coupon ends ${formatted}`;
	return formatted;
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}\u00A0M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}\u00A0k`;
	return n.toLocaleString("en-IN");
}

function SparklineBaseline() {
	return (
		<svg
			className="pointer-events-none absolute inset-x-0 -bottom-3 h-6 w-full text-muted-foreground/25"
			viewBox="0 0 100 24"
			preserveAspectRatio="none"
			aria-hidden
		>
			<line
				x1="0"
				y1="18"
				x2="100"
				y2="18"
				stroke="currentColor"
				strokeWidth="1"
				strokeDasharray="2 3"
			/>
		</svg>
	);
}

function ContextualFooterCta({
	entitlement,
	prefill,
}: {
	entitlement: EntitlementSnapshot;
	prefill?: { name?: string; email?: string; contact?: string };
}) {
	if (entitlement.status === "trialing") {
		return (
			<RazorpayCheckoutButton
				planCode="pro_monthly"
				label="Upgrade now"
				startMode="immediate"
				prefill={prefill}
				className="w-full"
			/>
		);
	}
	if (entitlement.status === "past_due" || entitlement.status === "grace") {
		const plan = entitlement.planCode === "pro_annual" ? "pro_annual" : "pro_monthly";
		return (
			<RazorpayCheckoutButton
				planCode={plan}
				label="Retry payment"
				startMode="immediate"
				variant="destructive"
				prefill={prefill}
				className="w-full"
			/>
		);
	}
	if (entitlement.status === "active" && entitlement.cancelAtPeriodEnd) {
		return (
			<Button
				variant="outline"
				className="w-full"
				render={<Link href="/student/subscription#plans" />}
			>
				Resume renewal
			</Button>
		);
	}
	return null;
}

export function PlanSummaryCard({
	entitlement,
	variant = "compact",
	className,
	prefill,
}: {
	entitlement: EntitlementSnapshot;
	variant?: Variant;
	className?: string;
	prefill?: { name?: string; email?: string; contact?: string };
}) {
	const plan = PLAN_CATALOG[entitlement.planCode];
	const Icon = plan.code === "free" ? SparklesIcon : CrownIcon;
	const testsPct = entitlement.testsQuota > 0
		? Math.min(100, Math.round((entitlement.testsUsed / entitlement.testsQuota) * 100))
		: 0;
	const tokensPct = entitlement.tokensQuota > 0
		? Math.min(100, Math.round((entitlement.tokensUsed / entitlement.tokensQuota) * 100))
		: 0;

	const renewal = formatRenewal(entitlement);
	const statusLabel = formatStatusLabel(entitlement);
	const tone = statusTone(entitlement);
	const showFooter =
		variant === "detail" &&
		(entitlement.status === "trialing" ||
			entitlement.status === "past_due" ||
			entitlement.status === "grace" ||
			(entitlement.status === "active" && entitlement.cancelAtPeriodEnd));

	return (
		<Card className={className}>
			<CardHeader className="gap-2">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-2">
						<div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
							<Icon className="size-4" aria-hidden />
						</div>
						<div>
							<CardTitle className="flex items-center gap-2">
								{plan.name}
								<Badge variant={tone} className="font-normal">
									{statusLabel}
								</Badge>
							</CardTitle>
							{renewal ? (
								<CardDescription className="mt-0.5">{renewal}</CardDescription>
							) : null}
						</div>
					</div>
					{variant === "compact" ? (
						<Button size="sm" variant="outline" render={<Link href="/student/subscription" />}>
							Manage
							<ArrowRightIcon aria-hidden />
						</Button>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="grid gap-5">
				<div className="relative grid gap-1.5">
					<div className="flex items-baseline justify-between text-sm">
						<span className="font-medium text-foreground">Practice tests</span>
						<span className="text-muted-foreground tabular-nums">
							{entitlement.testsUsed} / {entitlement.testsQuota}
						</span>
					</div>
					<Progress value={testsPct} className="gap-0">
						<ProgressTrack className="h-2 rounded-sm">
							<ProgressIndicator />
						</ProgressTrack>
					</Progress>
					<SparklineBaseline />
					<p className="text-xs text-muted-foreground tabular-nums">
						{entitlement.testsLeft === 0
							? "You have used all tests for this period."
							: `${entitlement.testsLeft}\u00A0test${entitlement.testsLeft === 1 ? "" : "s"} remaining`}
					</p>
				</div>
				<div className="grid gap-1.5">
					<div className="flex items-baseline justify-between text-sm">
						<span className="font-medium text-foreground">AI output (doubt chat)</span>
						<span className="text-muted-foreground tabular-nums">
							{formatTokens(entitlement.tokensUsed)} / {formatTokens(entitlement.tokensQuota)}
						</span>
					</div>
					<Progress value={tokensPct} className="gap-0">
						<ProgressTrack className="h-2 rounded-sm">
							<ProgressIndicator />
						</ProgressTrack>
					</Progress>
					<p className="text-xs text-muted-foreground tabular-nums">
						{entitlement.tokensLeft === 0
							? "You have used all AI output for this period."
							: `${formatTokens(entitlement.tokensLeft)} output tokens remaining`}
					</p>
				</div>
			</CardContent>
			{showFooter ? (
				<CardFooter>
					<ContextualFooterCta entitlement={entitlement} prefill={prefill} />
				</CardFooter>
			) : null}
		</Card>
	);
}
