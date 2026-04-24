import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketIcon } from "lucide-react";

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
import { createClient } from "@/lib/supabase/server";

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
		<div className="mx-auto w-full max-w-4xl p-6 md:p-8">
			<header className="flex flex-col gap-1">
				<p className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
					Billing
				</p>
				<h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
					Your subscription
				</h1>
				<p className="text-muted-foreground">
					Manage your EduAI plan, usage, payment method and receipts.
				</p>
			</header>

			<main className="mt-6 flex min-w-0 flex-col gap-6">
				{entitlement ? (
					<DevEnforcementBanner enforcementActive={entitlement.enforcementActive} />
				) : null}

				{showPaymentFailedAlert ? (
					<Alert variant="destructive">
						<AlertTitle>We could not collect your last payment</AlertTitle>
						<AlertDescription>
							Razorpay is retrying automatically. You have a short grace period before access is paused &mdash;
							please check your bank / UPI app for a pending mandate.
						</AlertDescription>
					</Alert>
				) : null}

				{entitlement?.cancelAtPeriodEnd ? (
					<Alert className="border-amber-500/30 bg-amber-500/[0.06] text-amber-900 dark:text-amber-100 [&_[data-slot=alert-description]]:text-amber-900/85 dark:[&_[data-slot=alert-description]]:text-amber-100/80">
						<AlertTitle>Auto-renewal off</AlertTitle>
						<AlertDescription>
							Your subscription is scheduled to end on {renewalDate}. You can re-enable renewal any time before then from the plan cards below.
						</AlertDescription>
					</Alert>
				) : null}

				{isTrialing && entitlement ? <TrialStateBand entitlement={entitlement} /> : null}

				<section id="plans" className="flex flex-col gap-4">
					<div>
						<h2 className="font-heading text-lg font-medium tracking-tight">Choose a plan</h2>
						<p className="text-sm text-muted-foreground">
							Paid plans are billed via Razorpay using secure UPI Autopay or card mandates.
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

				<PaymentHistorySection payments={payments} />

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<TicketIcon className="size-4 text-muted-foreground" aria-hidden />
							<CardTitle className="text-base">Have a coupon?</CardTitle>
						</div>
						<CardDescription>
							Parents with a distribution code can unlock a free month of Pro Monthly &mdash; no card required.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<CouponRedeemForm />
						{isPaid ? (
							<p className="text-xs text-muted-foreground">
								You already have an active paid subscription, so the coupon cannot be stacked right now.
							</p>
						) : null}
					</CardContent>
				</Card>

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
							href="/legal/terms"
							className="underline-offset-4 hover:text-foreground hover:underline"
						>
							Terms
						</Link>
					</div>
					<p>
						Cancel keeps your access until the end of the current period. Payment and mandate management happen on Razorpay.
					</p>
				</footer>
			</main>
		</div>
	);
}
