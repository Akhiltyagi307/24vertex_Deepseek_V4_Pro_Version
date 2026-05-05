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
import { billingEvents } from "@/db/schema/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		const now = new Date();
		const updated = await db
			.update(billingEvents)
			.set({ resolvedAt: now, resolvedBy: "admin" })
			.where(eq(billingEvents.id, uuid.data))
			.returning({ id: billingEvents.id });

		if (!updated[0]) return adminErrorResponse("Not found", { status: 404 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.BILLING_EVENT_RESOLVE,
			targetType: "billing_event",
			targetId: uuid.data,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
