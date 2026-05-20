import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { identityBlocklist } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z.object({
	identity_key: z.string().trim().min(1).max(512),
	reason: z.string().max(2000).optional(),
}).strict();

/** Blocks normalized identity from future trial signup (enforced when wired into seed path). */
export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = bodySchema.safeParse(raw);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		const reason = parsed.data.reason ?? `admin_jti:${gate.jti}`;

		await db
			.insert(identityBlocklist)
			.values({ identityKey: parsed.data.identity_key, reason })
			.onConflictDoUpdate({
				target: identityBlocklist.identityKey,
				set: { reason },
			});

		// Strict audit: kept symmetrical with TRIAL_CLAIM_RELEASE. When you
		// read the audit log later, you want both halves of the
		// give-trial / take-trial-away pair to be guaranteed-recorded —
		// a one-sided audit makes patterns of admin abuse hard to read.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.IDENTITY_BLOCKLIST_UPSERT,
			targetType: "identity_blocklist",
			targetId: parsed.data.identity_key,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
