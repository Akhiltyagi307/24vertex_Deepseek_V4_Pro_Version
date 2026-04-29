"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRightIcon, CrownIcon, SparklesIcon, ZapIcon } from "lucide-react";

import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { useSidebar } from "@/components/ui/sidebar";
import type { EntitlementSnapshot } from "@/lib/billing/entitlements";
import { PLAN_CATALOG } from "@/lib/billing/plans";
import { trialDaysLeftFromEnd } from "@/lib/billing/trial-days";
import { cn } from "@/lib/utils";

const TRIAL_TOTAL_DAYS = 14;

/** Live count from `trialEndsAt` so the sidebar matches billing after client navigations. */
function trialingDaysDisplayed(e: EntitlementSnapshot): number | null {
	if (e.status !== "trialing") return null;
	return trialDaysLeftFromEnd(e.trialEndsAt) ?? e.trialDaysLeft;
}

/** Shared with portal sidebars for collapsed-rail billing announcements. */
export function formatStatusLabel(e: EntitlementSnapshot): string {
	if (e.staffOverride) return "Staff override";
	switch (e.status) {
		case "trialing": {
			const d = trialingDaysDisplayed(e);
			if (d == null) return "Trial";
			return d === 0 ? "Ends today" : `${d} day${d === 1 ? "" : "s"} left`;
		}
		case "active":
			return e.cancelAtPeriodEnd ? "Cancels soon" : "Active";
		case "coupon":
			return "Complimentary";
		case "grace":
			return "Payment retrying";
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

type Tone = "ok" | "warn" | "danger" | "neutral";

export function statusTone(e: EntitlementSnapshot): Tone {
	const trialingDays = trialingDaysDisplayed(e);
	if (e.status === "past_due" || e.status === "expired" || e.status === "cancelled") return "danger";
	if (e.status === "trialing" && trialingDays != null && trialingDays <= 3) return "warn";
	if (e.status === "active" || e.status === "coupon") return "ok";
	if (e.status === "trialing") return "neutral";
	return "neutral";
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
	return n.toLocaleString("en-IN");
}

const toneStyles: Record<
	Tone,
	{ dot: string; pill: string; icon: string; border: string; ring: string }
> = {
	ok: {
		dot: "bg-emerald-500",
		pill: "text-emerald-700 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-300",
		icon: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
		border: "",
		ring: "",
	},
	warn: {
		dot: "bg-amber-500",
		pill: "text-amber-700 bg-amber-500/10 ring-amber-500/20 dark:text-amber-300",
		icon: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
		border: "border-amber-500/40",
		ring: "ring-1 ring-inset ring-amber-500/15",
	},
	danger: {
		dot: "bg-rose-500",
		pill: "text-rose-700 bg-rose-500/10 ring-rose-500/20 dark:text-rose-300",
		icon: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
		border: "border-rose-500/50",
		ring: "ring-1 ring-inset ring-rose-500/20",
	},
	neutral: {
		dot: "bg-sky-500",
		pill: "text-sky-700 bg-sky-500/10 ring-sky-500/20 dark:text-sky-300",
		icon: "bg-primary/10 text-primary ring-primary/15",
		border: "",
		ring: "",
	},
};

export function SidebarPlanCard({
	entitlement,
	className,
	manageHref = "/student/subscription",
}: {
	entitlement: EntitlementSnapshot;
	className?: string;
	/** Parent portal passes `/parent/subscription`. */
	manageHref?: string;
}) {
	const plan = PLAN_CATALOG[entitlement.planCode];
	const isFree = plan.code === "free";
	const Icon = isFree ? SparklesIcon : CrownIcon;

	const testsPct =
		entitlement.testsQuota > 0
			? Math.min(100, Math.round((entitlement.testsUsed / entitlement.testsQuota) * 100))
			: 0;
	const tokensPct =
		entitlement.tokensQuota > 0
			? Math.min(100, Math.round((entitlement.tokensUsed / entitlement.tokensQuota) * 100))
			: 0;

	const statusLabel = formatStatusLabel(entitlement);
	const tone = statusTone(entitlement);
	const t = toneStyles[tone];

	const { state, isMobile, openMobile } = useSidebar();
	const reduceMotion = useReducedMotion();
	const showPlanCard = isMobile ? openMobile : state === "expanded";

	const trialingDaysLive = trialingDaysDisplayed(entitlement);
	const showTrialStrip = entitlement.status === "trialing" && trialingDaysLive != null;
	const trialDaysPct = showTrialStrip
		? Math.max(0, Math.round(((trialingDaysLive ?? 0) / TRIAL_TOTAL_DAYS) * 100))
		: 0;

	const cardTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.26, ease: [0.25, 0.1, 0.25, 1] as const };

	return (
		<AnimatePresence initial={false} mode="sync">
			{showPlanCard ? (
				<motion.div
					key="sidebar-plan-card"
					initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
					transition={cardTransition}
					className={cn(
						cardSurfaceFrameClassName,
						"group/plancard relative p-4 shadow-sm",
						"bg-sidebar-accent/40 transition-colors duration-200 hover:bg-sidebar-accent/55",
						t.border ? t.border : undefined,
						t.ring,
						className,
					)}
				>
					{/* Header row */}
					<div className="relative flex items-center gap-2.5">
						<div
							className={cn(
								"grid size-7 shrink-0 place-items-center rounded-lg ring-1",
								t.icon,
							)}
						>
							<Icon className="size-3.5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-semibold leading-none text-sidebar-foreground">
								{plan.name}
							</div>
							<div className="mt-1.5 flex items-center gap-1.5">
								<span
									className={cn(
										"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none ring-1 ring-inset",
										t.pill,
									)}
								>
									<span className={cn("size-1.5 rounded-full", t.dot)} />
									{statusLabel}
								</span>
							</div>
						</div>
					</div>

					{/* Trial days strip */}
					{showTrialStrip && (
						<div className="relative mt-3.5">
							<div className="mb-1.5 flex items-center justify-between text-[10px] leading-none text-muted-foreground">
								<span>Trial period</span>
								<span className="tabular-nums">
									{trialingDaysLive}d of {TRIAL_TOTAL_DAYS}d remaining
								</span>
							</div>
							<div className="relative h-1 overflow-hidden rounded-full bg-muted">
								<motion.div
									className={cn("h-full rounded-full", t.dot)}
									initial={{ width: "100%" }}
									animate={{ width: `${trialDaysPct}%` }}
									transition={
										reduceMotion
											? { duration: 0 }
											: { duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }
									}
								/>
							</div>
						</div>
					)}

					{/* Quota meters */}
					<div className="relative mt-3.5 flex flex-col gap-2.5">
						<AnimatedMeter
							label="Tests"
							display={`${entitlement.testsUsed}/${entitlement.testsQuota}`}
							pct={testsPct}
							reduceMotion={!!reduceMotion}
						/>
						<AnimatedMeter
							label="AI output"
							display={`${formatTokens(entitlement.tokensUsed)}/${formatTokens(entitlement.tokensQuota)}`}
							pct={tokensPct}
							reduceMotion={!!reduceMotion}
						/>
					</div>

					{entitlement.enforcementActive &&
					!entitlement.staffOverride &&
					(entitlement.testsLeft === 0 || entitlement.tokensLeft === 0) ? (
						<p className="relative mt-2 text-[11px] leading-snug text-sidebar-foreground/70">
							{entitlement.testsLeft === 0 && entitlement.tokensLeft === 0
								? "Test and AI output limits reached for this period."
								: entitlement.testsLeft === 0
									? "No practice tests left this period."
									: "No AI output allowance left for doubt chat this period."}{" "}
							<Link
								href={manageHref}
								className="font-medium text-sidebar-foreground underline-offset-2 hover:underline"
							>
								View plans
							</Link>
						</p>
					) : null}

					{/* CTA */}
					<div className="mt-3.5">
						<Link
							href={manageHref}
							className={cn(
								"flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
								isFree
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "bg-sidebar-foreground/5 text-sidebar-foreground hover:bg-sidebar-foreground/10",
							)}
						>
							{isFree ? (
								<>
									<ZapIcon className="size-3.5" />
									Upgrade plan
								</>
							) : (
								<>
									Manage plan
									<ArrowUpRightIcon className="size-3.5" />
								</>
							)}
						</Link>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}

function AnimatedMeter({
	label,
	display,
	pct,
	reduceMotion,
}: {
	label: string;
	display: string;
	pct: number;
	reduceMotion: boolean;
}) {
	const barColor =
		pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-primary";

	return (
		<div
			role="meter"
			aria-label={label}
			aria-valuenow={pct}
			aria-valuemin={0}
			aria-valuemax={100}
			className="flex items-center gap-2 text-[11px] leading-none"
		>
			<span className="w-12 shrink-0 font-medium text-sidebar-foreground/80">{label}</span>
			<div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
				<motion.div
					className={cn("h-full rounded-full", barColor)}
					initial={{ width: "0%" }}
					animate={{ width: `${pct}%` }}
					transition={
						reduceMotion
							? { duration: 0 }
							: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }
					}
				/>
			</div>
			<span className="shrink-0 tabular-nums text-sidebar-foreground/60">{display}</span>
		</div>
	);
}
