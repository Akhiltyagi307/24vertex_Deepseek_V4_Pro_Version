import { desc, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS } from "@/lib/admin/response";
import { db } from "@/db";
import { adminActionLog } from "@/db/schema/admin-action-log";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const cursor = request.nextUrl.searchParams.get("cursor");
		const cursorId = cursor != null && Number.isFinite(Number(cursor)) ? Number(cursor) : null;

		const sel = {
			id: adminActionLog.id,
			action: adminActionLog.action,
			targetType: adminActionLog.targetType,
			targetId: adminActionLog.targetId,
			payload: adminActionLog.payload,
			createdAt: adminActionLog.createdAt,
		};

		const rows =
			cursorId != null ?
				await db
					.select(sel)
					.from(adminActionLog)
					.where(lt(adminActionLog.id, cursorId))
					.orderBy(desc(adminActionLog.id))
					.limit(PAGE_SIZE + 1)
			:	await db
					.select(sel)
					.from(adminActionLog)
					.orderBy(desc(adminActionLog.id))
					.limit(PAGE_SIZE + 1);
		const hasMore = rows.length > PAGE_SIZE;
		const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
		const nextCursor = hasMore ? String(page[PAGE_SIZE - 1]?.id) : null;

		// This endpoint uses cursor pagination (`next_cursor`), not the totals
		// + page + page_size shape that `adminListResponse` enforces. Keeping
		// the existing client contract — but applying the canonical headers
		// via `ADMIN_RESPONSE_HEADERS` so admin pages still get noindex.
		return NextResponse.json(
			{
				data: page.map((r) => ({
					id: r.id,
					action: r.action,
					target_type: r.targetType,
					target_id: r.targetId,
					payload: r.payload,
					created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
				})),
				next_cursor: nextCursor,
			},
			{ headers: { ...ADMIN_RESPONSE_HEADERS } },
		);
	});
}
