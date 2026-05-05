import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { fetchRazorpayPlan } from "@/lib/billing/razorpay";
import { db } from "@/db";
import { plans } from "@/db/schema/billing";

export const runtime = "nodejs";

const codeSchema = z.string().trim().min(1).max(32);

/** POST — read-only drift check vs Razorpay (no DB writes). */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const raw = (await ctx.params).code;
		const decoded = decodeURIComponent(raw);
		const parsedCode = codeSchema.safeParse(decoded);
		if (!parsedCode.success) {
			return adminErrorResponse("Invalid plan code");
		}

		const rows = await db.select().from(plans).where(eq(plans.code, parsedCode.data)).limit(1);
		const local = rows[0];
		if (!local) {
			return adminErrorResponse("Not found", { status: 404 });
		}
		if (!local.razorpayPlanId?.trim()) {
			return adminErrorResponse("Plan has no razorpay_plan_id; nothing to sync.", {
				details: { local: { code: local.code } },
			});
		}

		let remote: Awaited<ReturnType<typeof fetchRazorpayPlan>>;
		try {
			remote = await fetchRazorpayPlan(local.razorpayPlanId);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return adminErrorResponse("Razorpay fetch failed", { status: 502, details: { detail: msg } });
		}

		const remoteAmount = remote.item?.amount ?? null;
		const remoteCurrency = remote.item?.currency ?? null;
		const remoteName = remote.item?.name ?? null;
		const remotePeriod = remote.period ?? null;
		const remoteInterval = remote.interval ?? null;

		const periodMatches =
			remotePeriod == null ?
				null
			:	remotePeriod === "monthly" && local.interval === "monthly" ?
				true
			:	remotePeriod === "yearly" && local.interval === "yearly" ?
				true
			:	remotePeriod === local.interval;

		const priceDrift = remoteAmount != null && remoteAmount !== local.pricePaise;
		const intervalDrift = periodMatches === false;
		const nameDrift = remoteName != null && remoteName.trim() !== local.name.trim();

		return adminDetailResponse({
			local: {
				code: local.code,
				name: local.name,
				interval: local.interval,
				price_paise: local.pricePaise,
				razorpay_plan_id: local.razorpayPlanId,
			},
			remote: {
				id: remote.id,
				period: remotePeriod,
				interval: remoteInterval,
				item_name: remoteName,
				amount_paise: remoteAmount,
				currency: remoteCurrency,
			},
			drift: {
				price_paise: Boolean(priceDrift),
				interval: Boolean(intervalDrift),
				name: Boolean(nameDrift),
			},
		});
	});
}
