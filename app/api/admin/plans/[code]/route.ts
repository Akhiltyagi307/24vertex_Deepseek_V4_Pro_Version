import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { plans } from "@/db/schema/billing";

export const runtime = "nodejs";

const codeSchema = z.string().trim().min(1).max(32);

const patchBodySchema = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	interval: z.string().trim().min(1).max(16).optional(),
	price_paise: z.number().int().min(0).optional(),
	tests_per_period: z.number().int().min(0).optional(),
	tokens_grade_6_10: z.number().int().min(0).optional(),
	tokens_grade_11_12: z.number().int().min(0).optional(),
	pool_multiplier: z.number().int().min(1).optional(),
	is_active: z.boolean().optional(),
	sort_order: z.number().int().optional(),
}).strict();

export async function GET(_request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const raw = (await ctx.params).code;
		const decoded = decodeURIComponent(raw);
		const parsed = codeSchema.safeParse(decoded);
		if (!parsed.success) {
			return adminErrorResponse("Invalid plan code");
		}

		const rows = await db.select().from(plans).where(eq(plans.code, parsed.data)).limit(1);
		if (!rows[0]) {
			return adminErrorResponse("Not found", { status: 404 });
		}
		return adminDetailResponse(rows[0]);
	});
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
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

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = patchBodySchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}
		if (Object.keys(parsed.data).length === 0) {
			return adminErrorResponse("No fields to update");
		}

		const rows = await db.select().from(plans).where(eq(plans.code, parsedCode.data)).limit(1);
		if (!rows[0]) {
			return adminErrorResponse("Not found", { status: 404 });
		}

		const now = new Date();
		const patch = parsed.data;
		await db
			.update(plans)
			.set({
				...(patch.name != null ? { name: patch.name } : {}),
				...(patch.interval != null ? { interval: patch.interval } : {}),
				...(patch.price_paise != null ? { pricePaise: patch.price_paise } : {}),
				...(patch.tests_per_period != null ? { testsPerPeriod: patch.tests_per_period } : {}),
				...(patch.tokens_grade_6_10 != null ? { tokensGrade6to10: patch.tokens_grade_6_10 } : {}),
				...(patch.tokens_grade_11_12 != null ? { tokensGrade11to12: patch.tokens_grade_11_12 } : {}),
				...(patch.pool_multiplier != null ? { poolMultiplier: patch.pool_multiplier } : {}),
				...(patch.is_active != null ? { isActive: patch.is_active } : {}),
				...(patch.sort_order != null ? { sortOrder: patch.sort_order } : {}),
				updatedAt: now,
			})
			.where(eq(plans.code, parsedCode.data));

		// Strict audit: a plan PATCH sets pricing for every future purchase.
		// A missing audit row means a billing dispute or compliance question
		// ("who changed the price of plan X on date Y?") cannot be answered.
		// Volume is low (admins rarely fiddle with plan prices), so the
		// reliability cost of fail-closed is near-zero.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.PLAN_PATCH,
			targetType: "plan",
			targetId: parsedCode.data,
			payload: patch,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		const next = await db.select().from(plans).where(eq(plans.code, parsedCode.data)).limit(1);
		return adminDetailResponse(next[0]);
	});
}
