import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { getResendApiKey } from "@/lib/env";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

/**
 * Lists bounce / complaint suppressions from Resend (API passthrough).
 */
export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const apiKey = getResendApiKey();
	const res = await fetch("https://api.resend.com/suppressions/bounces", {
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
	});
	if (!res.ok) {
		const t = await res.text();
		return NextResponse.json({ error: t || "Resend API error" }, { status: 502, headers: adminHeaders() });
	}
	const data = (await res.json()) as unknown;
	return NextResponse.json({ data }, { headers: adminHeaders() });
}
