import Link from "next/link";
import { AlertCircleIcon, ArrowRightIcon, SparklesIcon } from "lucide-react";

import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger";

function chooseBanner(e: EntitlementSnapshot): null | {
	tone: Tone;
	title: string;
	body: string;
	ctaLabel: string;
} {
	const trialEnd = e.trialEndsAt ? new Date(e.trialEndsAt).getTime() : null;
	const now = Date.now();

	if (e.status === "grace" || e.status === "past_due") {
		return {
			tone: "danger",
			title: "Payment needs attention",
			body: "Razorpay is retrying your subscription charge. Update your payment method to avoid an interruption.",
			ctaLabel: "Fix payment",
		};
	}
	if (e.status === "expired" || e.reason === "trial_expired") {
		return {
			tone: "danger",
			title: "Your access has paused",
			body: "Your free trial or subscription has ended. Pick a plan to continue using Practice and Doubt-chat.",
			ctaLabel: "Pick a plan",
		};
	}
	if (e.status === "trialing" && trialEnd != null && trialEnd - now <= 3 * 86_400_000) {
		const days = e.trialDaysLeft ?? 0;
		return {
			tone: "warning",
			title: days === 0 ? "Your trial ends today" : `Only ${days} day${days === 1 ? "" : "s"} left on your trial`,
			body: "Add a payment method now so you never lose access — the first charge happens only after the trial ends.",
			ctaLabel: "Continue seamlessly",
		};
	}
	if (e.reason === "quota_tests" || e.reason === "quota_tokens") {
		return {
			tone: "warning",
			title: "You've hit your plan limit",
			body: e.reason === "quota_tests"
				? "You've used all the practice tests included in your plan."
				: "You've used all the AI output tokens for doubt chat included in your plan.",
			ctaLabel: "Upgrade",
		};
	}
	return null;
}

export function SubscriptionBanner({ entitlement }: { entitlement: EntitlementSnapshot | null }) {
	if (!entitlement) return null;
	if (entitlement.staffOverride) return null;
	if (!entitlement.enforcementActive && entitlement.status === "trialing" && entitlement.trialDaysLeft != null && entitlement.trialDaysLeft > 3) {
		return null;
	}

	const banner = chooseBanner(entitlement);
	if (!banner) return null;

	const toneClasses: Record<Tone, string> = {
		info: "bg-primary/5 text-primary border-primary/20",
		warning: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800/60",
		danger: "bg-destructive/10 text-destructive border-destructive/30",
	};
	const Icon = banner.tone === "danger" ? AlertCircleIcon : SparklesIcon;

	return (
		<div
			className={cn(
				"flex flex-col items-start gap-2 border-b px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4",
				toneClasses[banner.tone],
			)}
			role="status"
		>
			<div className="flex items-center gap-2">
				<Icon className="size-4 shrink-0" />
				<span className="font-medium">{banner.title}</span>
			</div>
			<p className="flex-1 text-[0.9rem] opacity-90">{banner.body}</p>
			<Link
				href="/student/subscription"
				className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
			>
				{banner.ctaLabel}
				<ArrowRightIcon className="size-3.5" />
			</Link>
		</div>
	);
}
