import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { getResendApiKey } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = z.object({ email: z.string().email(), reason: z.string().min(1).max(500) }).strict().safeParse(json);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}

	const apiKey = getResendApiKey();
	const res = await fetch(`https://api.resend.com/suppressions/bounces/${encodeURIComponent(parsed.data.email)}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!res.ok) {
		const t = await res.text();
		return adminErrorResponse(t || "Resend delete failed", { status: 502 });
	}

	// Strict audit: the Resend mutation already executed (an admin lifted a
	// bounce / complaint suppression — that recipient can receive mail
	// again). Missing audit row here would leave us unable to explain why an
	// addresses started receiving mail again.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.EMAIL_SUPPRESSION_REMOVE,
		payload: { email: parsed.data.email, reason: parsed.data.reason },
	});

	return adminAckResponse();
}
