import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketIcon } from "lucide-react";

import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { BillingTrustRow } from "@/components/student/subscription/billing-trust-row";
import { CancelSubscriptionButton } from "@/components/student/subscription/cancel-subscription-button";
import { DevEnforcementBanner } from "@/components/student/subscription/dev-enforcement-banner";
import {
	PaymentHistorySection,
	type PaymentHistoryRow,
} from "@/components/student/subscription/payment-history-section";
import { PlanComparison } from "@/components/student/subscription/plan-comparison";
import { PlanComparisonTable } from "@/components/student/subscription/plan-comparison-table";
import { TrialStateBand } from "@/components/student/subscription/trial-state-band";
import { CouponRedeemForm } from "@/components/student/subscription/coupon-redeem-form";
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
import { getCachedEntitlementsForProfile } from "@/lib/billing/entitlements";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isMissingProfileColumnError(error: {
	message: string;
	code?: string;
	details?: string | null;
	hint?: string | null;
} | null): boolean {
	if (!error) return false;
	if (error.code === "42703") return true;
	const blob = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
	return (
		(blob.includes("column") && (blob.includes("does not exist") || blob.includes("undefined column"))) ||
		(blob.includes("could not find") && blob.includes("column") && blob.includes("schema cache"))
	);
}

export default async function ParentSubscriptionPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");

	const parentRow = await getCachedAppProfileRow();
	if (!parentRow || parentRow.role !== "parent") redirect("/login");

	const activeId = await getParentActiveStudentIdFromCookie();
	if (!activeId) redirect("/parent/select-student");
	const ok = await assertParentActiveLink(user.id, activeId);
	if (!ok) redirect("/parent/select-student");

	const supabase = await createClient();
	const { data: studentProfileWithPhone, error: studentProfileErr } = await supabase
		.from("profiles")
		.select("full_name, grade, phone")
		.eq("id", activeId)
		.maybeSingle();
	let studentProfile = studentProfileWithPhone;
	if (studentProfileErr && isMissingProfileColumnError(studentProfileErr)) {
		const { data: studentProfileFallback } = await supabase
			.from("profiles")
			.select("full_name, grade")
			.eq("id", activeId)
			.maybeSingle();
		studentProfile = studentProfileFallback ? { ...studentProfileFallback, phone: null } : null;
	}

	if (!studentProfile) redirect("/parent/select-student");

	const childName = formatPersonDisplayName(studentProfile.full_name ?? "") || "Your child";

	const [entitlement, paymentsRes, planCatalog] = await Promise.all([
		getCachedEntitlementsForProfile(activeId),
		supabase
			.from("payments")
			.select("id, amount_paise, currency, status, method, invoice_short_url, created_at")
			.eq("profile_id", activeId)
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
		name: studentProfile.full_name ?? undefined,
		email: user.email ?? undefined,
		contact: studentProfile.phone ?? undefined,
	};

	const renewalDate = entitlement
		? new Date(entitlement.currentPeriodEnd).toLocaleDateString("en-IN", {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: "";

	return (
		<div className="w-full min-w-0 py-6 sm:py-8">
			<main className="min-w-0">
				<PageStaggerRoot
					enableLift={false}
					className="flex w-full min-w-0 flex-col gap-6 sm:gap-8"
					sections={[
						{
							key: "header",
							content: (
								<header className="flex shrink-0 flex-col gap-1.5">
									<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">
										{childName}&apos;s plan &amp; billing
									</h1>
									<PageHeaderSubtext>
										Manage EduAI access for this child. Checkout uses your email; the subscription is tied to
										their student account.
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
											<AlertTitle>Last payment didn&apos;t go through</AlertTitle>
											<AlertDescription>
												Razorpay may retry automatically. Ask your bank or UPI app about pending mandates so
												access isn&apos;t interrupted.
											</AlertDescription>
										</Alert>
									) : null}

									{entitlement?.cancelAtPeriodEnd ? (
										<Alert className="border-amber-500/30 bg-amber-500/[0.06] text-amber-900 dark:text-amber-100 [&_[data-slot=alert-description]]:text-amber-900/85 dark:[&_[data-slot=alert-description]]:text-amber-100/80">
											<AlertTitle>Auto-renewal off</AlertTitle>
											<AlertDescription>
												After {renewalDate} this plan will end unless renewal is turned back on.
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
											Upgrade when your family wants more practice tests or tutor-chat allowance for this child.
										</p>
									</div>
									<PlanComparison
										currentPlanCode={entitlement?.planCode ?? "free"}
										isTrialing={!!isTrialing}
										trialEndsAt={entitlement?.trialEndsAt ?? null}
										trialDaysLeft={entitlement?.trialDaysLeft ?? null}
										grade={studentProfile.grade ?? null}
										prefill={prefill}
										planCatalog={planCatalog}
										billingProfileId={activeId}
									/>
									<PlanComparisonTable
										currentPlanCode={entitlement?.planCode ?? "free"}
										grade={studentProfile.grade ?? null}
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
											If you have a code from school or a campaign, apply it here for a complimentary Pro window
											on this child&apos;s account, with no card needed.
										</CardDescription>
									</CardHeader>
									<CardContent className="flex flex-col gap-3">
										<CouponRedeemForm billingProfileId={activeId} />
										{isPaid ? (
											<p className="text-xs text-muted-foreground">
												This student is already on a paid Razorpay plan, so a coupon can&apos;t be stacked on top
												right now.
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
										<CancelSubscriptionButton
											disabled={!isPaid || entitlement?.cancelAtPeriodEnd}
											billingProfileId={activeId}
										/>
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
								</footer>
							),
						},
					]}
				/>
			</main>
		</div>
	);
}
