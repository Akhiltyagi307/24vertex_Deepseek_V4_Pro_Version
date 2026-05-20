import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z.object({
	staff_override: z.boolean(),
}).strict();

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
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}
		const staffOverride = parsed.data.staff_override;

		const updated = await db
			.update(subscriptions)
			.set({ staffOverride, updatedAt: new Date() })
			.where(eq(subscriptions.id, uuid.data))
			.returning({ id: subscriptions.id });

		if (!updated[0]) return adminErrorResponse("Not found", { status: 404 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_STAFF_OVERRIDE,
			targetType: "subscription",
			targetId: uuid.data,
			payload: { staff_override: staffOverride },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({ staff_override: staffOverride });
	});
}
