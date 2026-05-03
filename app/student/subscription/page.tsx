import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketIcon } from "lucide-react";

import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { BillingTrustRow } from "@/components/student/subscription/billing-trust-row";
import { CancelSubscriptionButton } from "@/components/student/subscription/cancel-subscription-button";
import { CouponRedeemForm } from "@/components/student/subscription/coupon-redeem-form";
import { DevEnforcementBanner } from "@/components/student/subscription/dev-enforcement-banner";
import {
	PaymentHistorySection,
	type PaymentHistoryRow,
} from "@/components/student/subscription/payment-history-section";
import { PlanComparison } from "@/components/student/subscription/plan-comparison";
import { PlanComparisonTable } from "@/components/student/subscription/plan-comparison-table";
import { TrialStateBand } from "@/components/student/subscription/trial-state-band";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getCachedPlanCatalog } from "@/lib/cache/deterministic-lookups";
import { getCachedEntitlements } from "@/lib/billing/entitlements";
import { studentHubPageShellClassName } from "@/lib/student/student-hub-page-layout";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudentSubscriptionPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");

	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") redirect("/login");
	const profile = row;

	const supabase = await createClient();
	const [entitlement, paymentsRes, planCatalog] = await Promise.all([
		getCachedEntitlements(),
		supabase
			.from("payments")
			.select("id, amount_paise, currency, status, method, invoice_short_url, created_at")
			.eq("profile_id", user.id)
			.order("created_at", { ascending: false })
			.limit(12),
		getCachedPlanCatalog(),
	]);
	const payments = (paymentsRes.data ?? []) as PaymentHistoryRow[];

	const isPaid =
		entitlement?.status === "active" ||
		entitlement?.status === "grace" ||
		entitlement?.status === "past_due";
	const isTrialing = entitlement?.status === "trialing";
	const showPaymentFailedAlert = entitlement?.status === "grace" || entitlement?.status === "past_due";

	const prefill = {
		name: profile.full_name ?? undefined,
		email: user.email ?? undefined,
		contact: profile.phone ?? undefined,
	};

	const renewalDate = entitlement
		? new Date(entitlement.currentPeriodEnd).toLocaleDateString("en-IN", {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: "";

	return (
		<div className={cn("min-w-0 py-6 medium:py-8", studentHubPageShellClassName)}>
			<main className="min-w-0">
				<PageStaggerRoot
					enableLift={false}
					className="flex w-full min-w-0 flex-col gap-6 medium:gap-8"
					sections={[
						{
							key: "header",
							content: (
								<header className="flex shrink-0 flex-col gap-1.5">
									<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">
										Your subscription
									</h1>
									<PageHeaderSubtext>
										See your plan, usage, payment history, and upgrade options when you need more practice or AI
										help.
									</PageHeaderSubtext>
								</header>
							),
						},
						{
							key: "status",
							content: (
								<div className="flex min-w-0 flex-col gap-6">
									{entitlement ? (
										<DevEnforcementBanner enforcementActive={entitlement.enforcementActive} />
									) : null}

									{showPaymentFailedAlert ? (
										<Alert variant="destructive">
											<AlertTitle>Your last payment didn’t go through</AlertTitle>
											<AlertDescription>
												Razorpay will try again automatically. You still have a short grace period: check your bank
												app or UPI for a failed or pending mandate so your access isn’t paused.
											</AlertDescription>
										</Alert>
									) : null}

									{entitlement?.cancelAtPeriodEnd ? (
										<Alert className="border-amber-500/30 bg-amber-500/[0.06] text-amber-900 dark:text-amber-100 [&_[data-slot=alert-description]]:text-amber-900/85 dark:[&_[data-slot=alert-description]]:text-amber-100/80">
											<AlertTitle>Auto-renewal off</AlertTitle>
											<AlertDescription>
												After {renewalDate} your plan will end unless you turn renewal back on. You can switch it
												on again anytime before that date from the plan cards below.
											</AlertDescription>
										</Alert>
									) : null}

									{isTrialing && entitlement ? <TrialStateBand entitlement={entitlement} /> : null}
								</div>
							),
						},
						{
							key: "plans",
							content: (
								<section id="plans" className="flex flex-col gap-4">
									<div>
										<h2 className="font-heading text-lg font-medium tracking-tight">Choose a plan</h2>
										<p className="text-pretty text-sm text-muted-foreground">
											Pick what fits how often you’ll practice and use the AI tutor. Paid plans use Razorpay with
											UPI Autopay or card; checkout is secure, and you can cancel from this page.
										</p>
									</div>
									<PlanComparison
										currentPlanCode={entitlement?.planCode ?? "free"}
										isTrialing={!!isTrialing}
										trialEndsAt={entitlement?.trialEndsAt ?? null}
										trialDaysLeft={entitlement?.trialDaysLeft ?? null}
										grade={profile.grade ?? null}
										prefill={prefill}
										planCatalog={planCatalog}
									/>
									<PlanComparisonTable
										currentPlanCode={entitlement?.planCode ?? "free"}
										grade={profile.grade ?? null}
										planCatalog={planCatalog}
									/>
									<BillingTrustRow />
								</section>
							),
						},
						{
							key: "payments",
							content: <PaymentHistorySection payments={payments} />,
						},
						{
							key: "coupon",
							content: (
								<Card>
									<CardHeader>
										<div className="flex items-center gap-2">
											<TicketIcon className="size-4 text-muted-foreground" aria-hidden />
											<CardTitle className="text-base">Have a coupon?</CardTitle>
										</div>
										<CardDescription className="text-pretty">
											If your parent has a code from school or a campaign, you can apply it here for a free month
											on Pro Monthly, with no card needed.
										</CardDescription>
									</CardHeader>
									<CardContent className="flex flex-col gap-3">
										<CouponRedeemForm />
										{isPaid ? (
											<p className="text-xs text-muted-foreground">
												You’re already on a paid plan, so a coupon can’t be added on top right now.
											</p>
										) : null}
									</CardContent>
								</Card>
							),
						},
						{
							key: "footer",
							content: (
								<footer className="flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground">
									<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
										<CancelSubscriptionButton disabled={!isPaid || entitlement?.cancelAtPeriodEnd} />
										<Link
											href="/legal/refund"
											className="underline-offset-4 hover:text-foreground hover:underline"
										>
											Refund &amp; cancellation policy
										</Link>
										<Link
											href="/legal/shipping"
											className="underline-offset-4 hover:text-foreground hover:underline"
										>
											Shipping &amp; delivery
										</Link>
										<Link
											href="/legal/privacy"
											className="underline-offset-4 hover:text-foreground hover:underline"
										>
											Privacy policy
										</Link>
										<Link
											href="/legal/terms"
											className="underline-offset-4 hover:text-foreground hover:underline"
										>
											Terms
										</Link>
									</div>
									<p>
										If you cancel, you keep full access until the end of the period you already paid for. Card and
										UPI mandate details are managed safely on Razorpay’s site.
									</p>
								</footer>
							),
						},
					]}
				/>
			</main>
		</div>
	);
}
