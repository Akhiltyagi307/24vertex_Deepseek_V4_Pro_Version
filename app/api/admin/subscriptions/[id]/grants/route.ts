import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { quotaGrants, subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

const postBodySchema = z.object({
	grant_type: z.enum(["tests"]),
	quantity: z.number().int().positive().max(10_000),
	expires_at: z.string().datetime().optional().nullable(),
	note: z.string().max(2000).optional().nullable(),
});

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

		const subRows = await db
			.select({ profileId: subscriptions.profileId })
			.from(subscriptions)
			.where(eq(subscriptions.id, uuid.data))
			.limit(1);
		const sub = subRows[0];
		if (!sub) return adminErrorResponse("Not found", { status: 404 });

		const rows = await db
			.select()
			.from(quotaGrants)
			.where(eq(quotaGrants.studentId, sub.profileId))
			.orderBy(desc(quotaGrants.createdAt))
			.limit(200);

		return adminDetailResponse(
			rows.map((r) => ({
				id: r.id,
				student_id: r.studentId,
				grant_type: r.grantType,
				quantity: r.quantity,
				consumed: r.consumed,
				expires_at: r.expiresAt?.toISOString() ?? null,
				note: r.note,
				created_by: r.createdBy,
				created_at: r.createdAt.toISOString(),
			})),
		);
	});
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = postBodySchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		const subRows = await db
			.select({ profileId: subscriptions.profileId })
			.from(subscriptions)
			.where(eq(subscriptions.id, uuid.data))
			.limit(1);
		const sub = subRows[0];
		if (!sub) return adminErrorResponse("Not found", { status: 404 });

		const expiresAt =
			parsed.data.expires_at ? new Date(parsed.data.expires_at) : null;
		if (expiresAt && Number.isNaN(expiresAt.getTime())) {
			return adminErrorResponse("Invalid expires_at");
		}

		const createdBy = `admin_jti:${gate.jti}`;
		const inserted = await db
			.insert(quotaGrants)
			.values({
				studentId: sub.profileId,
				grantType: parsed.data.grant_type,
				quantity: parsed.data.quantity,
				consumed: 0,
				expiresAt,
				note: parsed.data.note ?? null,
				createdBy,
			})
			.returning();

		const row = inserted[0];
		if (!row) return adminErrorResponse("Insert failed", { status: 500 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.QUOTA_GRANT_CREATE,
			targetType: "quota_grant",
			targetId: row.id,
			payload: {
				subscription_id: uuid.data,
				student_id: sub.profileId,
				grant_type: row.grantType,
				quantity: row.quantity,
				expires_at: row.expiresAt?.toISOString() ?? null,
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminDetailResponse({
			id: row.id,
			student_id: row.studentId,
			grant_type: row.grantType,
			quantity: row.quantity,
			consumed: row.consumed,
			expires_at: row.expiresAt?.toISOString() ?? null,
			note: row.note,
			created_by: row.createdBy,
			created_at: row.createdAt.toISOString(),
		});
	});
}
