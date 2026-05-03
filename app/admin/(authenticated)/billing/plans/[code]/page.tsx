import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AdminPlanEditForm } from "@/components/admin/billing/admin-plan-edit-form";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { plans } from "@/db/schema/billing";

export const metadata = {
	title: "Admin · Billing · Plan",
	robots: { index: false, follow: false },
};

type Props = { params: Promise<{ code: string }> };

export default async function AdminBillingPlanDetailPage({ params }: Props) {
	const code = decodeURIComponent((await params).code);
	const row = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
	const plan = row[0];
	if (!plan) notFound();

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Plans", href: "/admin/billing/plans" },
					{ label: plan.code },
				]}
				title={plan.name}
				description={`Plan code ${plan.code} · ${plan.interval}`}
			/>
			<div className="grid max-w-2xl gap-3 rounded-lg border border-border p-4 text-sm">
				<Detail label="Code" value={<span className="font-mono">{plan.code}</span>} />
				<Detail label="Interval" value={plan.interval} />
				<Detail label="Price (paise)" value={String(plan.pricePaise)} />
				<Detail label="Tests per period" value={String(plan.testsPerPeriod)} />
				<Detail label="Tokens (grades 6–10)" value={String(plan.tokensGrade6to10)} />
				<Detail label="Tokens (grades 11–12)" value={String(plan.tokensGrade11to12)} />
				<Detail label="Pool multiplier" value={String(plan.poolMultiplier)} />
				<Detail label="Razorpay plan id" value={plan.razorpayPlanId ? <span className="font-mono text-xs">{plan.razorpayPlanId}</span> : "—"} />
				<Detail label="Active" value={plan.isActive ? "yes" : "no"} />
				<Detail label="Sort order" value={String(plan.sortOrder)} />
				<Detail label="Updated" value={plan.updatedAt.toISOString()} />
			</div>

			<AdminPlanEditForm
				initial={{
					code: plan.code,
					name: plan.name,
					interval: plan.interval,
					price_paise: plan.pricePaise,
					tests_per_period: plan.testsPerPeriod,
					tokens_grade_6_10: plan.tokensGrade6to10,
					tokens_grade_11_12: plan.tokensGrade11to12,
					pool_multiplier: plan.poolMultiplier,
					is_active: plan.isActive,
					sort_order: plan.sortOrder,
					razorpay_plan_id: plan.razorpayPlanId ?? null,
				}}
			/>

			<p className="text-sm text-muted-foreground">
				<Link className="text-primary underline-offset-4 hover:underline" href="/admin/billing/plans">
					← All plans
				</Link>
			</p>
		</div>
	);
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
			<dt className="w-48 shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 font-medium">{value}</dd>
		</div>
	);
}
