import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { fetchRazorpayPlan } from "@/lib/billing/razorpay";
import { db } from "@/db";
import { plans } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

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
			return NextResponse.json({ error: "Invalid plan code" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db.select().from(plans).where(eq(plans.code, parsedCode.data)).limit(1);
		const local = rows[0];
		if (!local) {
			return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		}
		if (!local.razorpayPlanId?.trim()) {
			return NextResponse.json(
				{ error: "Plan has no razorpay_plan_id; nothing to sync.", local: { code: local.code } },
				{ status: 400, headers: adminHeaders() },
			);
		}

		let remote: Awaited<ReturnType<typeof fetchRazorpayPlan>>;
		try {
			remote = await fetchRazorpayPlan(local.razorpayPlanId);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return NextResponse.json({ error: "Razorpay fetch failed", detail: msg }, { status: 502, headers: adminHeaders() });
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

		return NextResponse.json(
			{
				data: {
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
				},
			},
			{ headers: adminHeaders() },
		);
	});
}
