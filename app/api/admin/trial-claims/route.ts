import { count, desc, isNull, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { freeTrialClaims } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(200, Math.max(1, Number(sp.get("page_size") ?? "40") || 40));
		const offset = (page - 1) * pageSize;
		const released = sp.get("released");

		const whereClause =
			released === "1" ? isNotNull(freeTrialClaims.releasedAt)
			: released === "0" ? isNull(freeTrialClaims.releasedAt)
			: undefined;

		const listBase = db.select().from(freeTrialClaims);
		const listFiltered = whereClause ? listBase.where(whereClause) : listBase;
		const rows = await listFiltered.orderBy(desc(freeTrialClaims.claimedAt)).limit(pageSize).offset(offset);

		const countBase = db.select({ total: count() }).from(freeTrialClaims);
		const countFiltered = whereClause ? countBase.where(whereClause) : countBase;
		const [{ total }] = await countFiltered;

		return NextResponse.json(
			{
				data: rows.map((r) => ({
					identity_key: r.identityKey,
					first_profile_id: r.firstProfileId,
					claimed_at: r.claimedAt.toISOString(),
					released_at: r.releasedAt?.toISOString() ?? null,
					released_by: r.releasedBy,
					released_reason: r.releasedReason,
				})),
				total: Number(total ?? 0),
				page,
				page_size: pageSize,
			},
			{ headers: adminHeaders() },
		);
	});
}
