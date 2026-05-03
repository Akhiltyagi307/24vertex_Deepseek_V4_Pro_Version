import { z } from "zod";
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { db } from "@/db";
import { contentBlacklist } from "@/db/schema/content-blacklist";
import { embedText1536 } from "@/lib/ai/moderation";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const postSchema = z.object({
	pattern_type: z.enum(["regex", "embedding"]),
	pattern: z.string().min(1).max(20_000),
	applies_to: z.string().min(1).max(30).default("question_generator"),
	reason: z.string().min(1).max(500),
});

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const rows = await db.select().from(contentBlacklist).orderBy(desc(contentBlacklist.createdAt)).limit(200);
		return NextResponse.json({ data: rows }, { headers: adminHeaders() });
	});
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let json: unknown;
		try {
			json = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = postSchema.safeParse(json);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: adminHeaders() });
		}

		let embedding: number[] | null = null;
		if (parsed.data.pattern_type === "embedding") {
			embedding = await embedText1536(parsed.data.pattern);
			if (!embedding) {
				return NextResponse.json(
					{ error: "Could not compute embedding (OPENAI_API_KEY / network)." },
					{ status: 400, headers: adminHeaders() },
				);
			}
		}

		const [row] = await db
			.insert(contentBlacklist)
			.values({
				patternType: parsed.data.pattern_type,
				pattern: parsed.data.pattern,
				reason: parsed.data.reason,
				appliesTo: parsed.data.applies_to,
				...(embedding ? { embedding } : {}),
			})
			.returning({ id: contentBlacklist.id });

		await writeAdminAction({
			action: "moderation_blacklist_add",
			targetType: "content_blacklist",
			targetId: row?.id ?? "",
			payload: { pattern_type: parsed.data.pattern_type },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ data: { id: row?.id } }, { headers: adminHeaders() });
	});
}
