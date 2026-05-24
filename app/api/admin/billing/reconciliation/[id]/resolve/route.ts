import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { billingReconciliationDrift } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z
	.object({
		resolution_note: z.string().min(1).max(2000),
	})
	.strict();

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		let json: unknown;
		try {
			json = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = bodySchema.safeParse(json);
		if (!parsed.success) return adminErrorResponse("Invalid body");

		const rows = await db
			.select({ id: billingReconciliationDrift.id, resolvedAt: billingReconciliationDrift.resolvedAt })
			.from(billingReconciliationDrift)
			.where(eq(billingReconciliationDrift.id, uuid.data))
			.limit(1);

		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });
		if (row.resolvedAt) return adminAckResponse({ noop: true });

		const now = new Date();
		await db
			.update(billingReconciliationDrift)
			.set({
				resolvedAt: now,
				resolvedByJti: gate.jti,
				resolutionNote: parsed.data.resolution_note,
			})
			.where(eq(billingReconciliationDrift.id, uuid.data));

		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.BILLING_RECONCILIATION_DRIFT_RESOLVE,
			targetType: "billing_reconciliation_drift",
			targetId: uuid.data,
			payload: { resolution_note: parsed.data.resolution_note },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
