import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { getResendApiKey } from "@/lib/env";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = z.object({ email: z.string().email(), reason: z.string().min(1).max(500) }).safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "email_suppression_remove",
		payload: { email: parsed.data.email, reason: parsed.data.reason },
	});

	const apiKey = getResendApiKey();
	const res = await fetch(`https://api.resend.com/suppressions/bounces/${encodeURIComponent(parsed.data.email)}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!res.ok) {
		const t = await res.text();
		return NextResponse.json({ error: t || "Resend delete failed" }, { status: 502, headers: adminHeaders() });
	}

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
