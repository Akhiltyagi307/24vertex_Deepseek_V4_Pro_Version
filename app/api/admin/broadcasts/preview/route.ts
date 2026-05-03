import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { countBroadcastAudience, type BroadcastAudienceJson } from "@/lib/admin/broadcast-audience";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const audienceSchema = z.object({
	kind: z.enum(["all", "students", "parents", "teachers", "grade", "plan"]),
	grade: z.number().optional(),
	section: z.string().optional(),
	stream: z.string().optional(),
	plan_code: z.string().optional(),
});

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = z.object({ audience: audienceSchema }).safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
	}
	const audience = parsed.data.audience as BroadcastAudienceJson;
	const count = await countBroadcastAudience(audience);
	return NextResponse.json({ count }, { headers: adminHeaders() });
}
