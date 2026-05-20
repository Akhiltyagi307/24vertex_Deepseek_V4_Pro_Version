import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { countBroadcastAudience, type BroadcastAudienceJson } from "@/lib/admin/broadcast-audience";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";

export const runtime = "nodejs";

const audienceSchema = z.object({
	kind: z.enum(["all", "students", "parents", "teachers", "grade", "plan"]),
	grade: z.number().optional(),
	section: z.string().optional(),
	stream: z.string().optional(),
	plan_code: z.string().optional(),
}).strict();

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = z.object({ audience: audienceSchema }).strict().safeParse(json);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}
	const audience = parsed.data.audience as BroadcastAudienceJson;
	const count = await countBroadcastAudience(audience);
	return NextResponse.json({ count }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
}
