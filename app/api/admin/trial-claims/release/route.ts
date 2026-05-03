import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { freeTrialClaims } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const bodySchema = z.object({
	identity_key: z.string().trim().min(1).max(512),
	reason: z.string().max(2000).optional(),
});

/** Allows another profile to claim a free trial for the same normalized identity. */
export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = bodySchema.safeParse(raw);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const now = new Date();
		const releasedBy = `admin_jti:${gate.jti}`;
		const updated = await db
			.update(freeTrialClaims)
			.set({
				releasedAt: now,
				releasedBy,
				releasedReason: parsed.data.reason ?? null,
			})
			.where(and(eq(freeTrialClaims.identityKey, parsed.data.identity_key), isNull(freeTrialClaims.releasedAt)))
			.returning({ identityKey: freeTrialClaims.identityKey });

		if (!updated[0]) {
			return NextResponse.json(
				{ error: "No active claim for that identity_key (already released or unknown)." },
				{ status: 404, headers: adminHeaders() },
			);
		}

		await writeAdminAction({
			action: "trial_claim_release",
			targetType: "trial_claim",
			targetId: parsed.data.identity_key,
			payload: { reason: parsed.data.reason ?? null },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
