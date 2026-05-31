/**
 * Plan catalog + quota resolution helpers.
 *
 * Source of truth for numbers lives in the `plans` table
 * (see supabase/migrations/20260423000001_saas_billing.sql). These constants
 * mirror that seed so the UI can render the plan comparison without a DB hop.
 */

export type PlanCode = "free" | "pro_monthly" | "pro_annual";

/** Plans that can be purchased via Razorpay checkout (checkout_discount coupons apply here). */
export const PAID_CHECKOUT_PLAN_CODES: PlanCode[] = ["pro_monthly", "pro_annual"];

export type PlanInterval = "trial" | "month" | "year";

export type PlanCatalogEntry = {
	code: PlanCode;
	name: string;
	interval: PlanInterval;
	pricePaise: number;
	testsPerPeriod: number;
	/** Doubt-chat quota: model output (completion) tokens per billing period. */
	tokensGrade6to10: number;
	/** Doubt-chat quota: model output (completion) tokens per billing period. */
	tokensGrade11to12: number;
	poolMultiplier: number;
	highlight?: boolean;
	annualSavingsPercent?: number;
};

export const PLAN_CATALOG: Record<PlanCode, PlanCatalogEntry> = {
	free: {
		code: "free",
		name: "Free Trial",
		interval: "trial",
		pricePaise: 0,
		testsPerPeriod: 5,
		tokensGrade6to10: 50_000,
		tokensGrade11to12: 50_000,
		poolMultiplier: 1,
	},
	pro_monthly: {
		code: "pro_monthly",
		name: "Pro Monthly",
		interval: "month",
		pricePaise: 60_000, // ₹600.00
		testsPerPeriod: 30,
		tokensGrade6to10: 200_000,
		tokensGrade11to12: 400_000,
		poolMultiplier: 1,
		highlight: true,
	},
	pro_annual: {
		code: "pro_annual",
		name: "Pro Annual",
		interval: "year",
		pricePaise: 600_000, // ₹6,000.00 (2 months free vs monthly)
		testsPerPeriod: 360,
		tokensGrade6to10: 2_400_000,
		tokensGrade11to12: 4_800_000,
		poolMultiplier: 12,
		annualSavingsPercent: 17, // ₹7,200/yr at monthly rate − ₹6,000 yearly
	},
};

export const PLAN_CODES: PlanCode[] = ["free", "pro_monthly", "pro_annual"];

export function isPlanCode(value: unknown): value is PlanCode {
	return typeof value === "string" && (value === "free" || value === "pro_monthly" || value === "pro_annual");
}

/** Monthly/annual display formatter, e.g. ₹600. */
export function formatRupees(paise: number): string {
	const rupees = Math.round(paise / 100);
	return `₹${rupees.toLocaleString("en-IN")}`;
}

/** Whole rupees for marketing copy (no ₹ prefix). */
export function rupeesFromPaise(paise: number): number {
	return Math.round(paise / 100);
}

/** Effective monthly cost when paying yearly (₹500 at ₹6,000/yr). */
export function annualEffectiveMonthlyRupees(): number {
	return Math.round(PLAN_CATALOG.pro_annual.pricePaise / 100 / 12);
}

/** Total rupees saved vs 12× monthly when choosing yearly. */
export function annualSavingsVsMonthlyRupees(): number {
	return rupeesFromPaise(PLAN_CATALOG.pro_monthly.pricePaise) * 12 - rupeesFromPaise(PLAN_CATALOG.pro_annual.pricePaise);
}

/** Tokens for a student's grade under a given plan. */
export function tokenQuotaForGrade(plan: PlanCatalogEntry, grade: number | null): number {
	if (grade != null && grade >= 11 && grade <= 12) return plan.tokensGrade11to12;
	return plan.tokensGrade6to10;
}
