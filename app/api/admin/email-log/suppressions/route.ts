import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { getResendApiKey } from "@/lib/env";

export const runtime = "nodejs";

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
		return adminErrorResponse(t || "Resend API error", { status: 502 });
	}
	const data = (await res.json()) as unknown;
	return adminDetailResponse(data);
}
