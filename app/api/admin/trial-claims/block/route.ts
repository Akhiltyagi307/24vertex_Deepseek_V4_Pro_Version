import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { identityBlocklist } from "@/db/schema/billing";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const bodySchema = z.object({
	identity_key: z.string().trim().min(1).max(512),
	reason: z.string().max(2000).optional(),
});

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
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = bodySchema.safeParse(raw);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const reason = parsed.data.reason ?? `admin_jti:${gate.jti}`;

		await db
			.insert(identityBlocklist)
			.values({ identityKey: parsed.data.identity_key, reason })
			.onConflictDoUpdate({
				target: identityBlocklist.identityKey,
				set: { reason },
			});

		await writeAdminAction({
			action: "identity_blocklist_upsert",
			targetType: "identity_blocklist",
			targetId: parsed.data.identity_key,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
