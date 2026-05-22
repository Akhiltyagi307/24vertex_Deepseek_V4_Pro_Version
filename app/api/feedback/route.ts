import { z } from "zod";

import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";
import { consumeFeedbackSubmitRateLimit } from "@/lib/feedback/rate-limit";
import { scrubFeedbackContext, scrubFeedbackText } from "@/lib/feedback/scrub-feedback-context";
import {
	FEEDBACK_CATEGORIES,
	FEEDBACK_IMPACTS,
	FEEDBACK_PORTALS,
	portalMatchesProfileRole,
	type FeedbackPortal,
} from "@/lib/feedback/types";
import { createClient } from "@/lib/supabase/server";
import { eq } from "drizzle-orm";

const clientContextSchema = z
	.object({
		viewport: z
			.object({
				w: z.number().int().min(0).max(10_000),
				h: z.number().int().min(0).max(10_000),
			})
			.optional(),
		locale: z.string().max(20).optional(),
	})
	.strict();

const bodySchema = z
	.object({
		portal: z.enum(FEEDBACK_PORTALS),
		category: z.enum(FEEDBACK_CATEGORIES),
		description: z.string().min(20).max(4000),
		title: z.string().max(200).optional(),
		impact: z.enum(FEEDBACK_IMPACTS).optional(),
		pagePath: z.string().min(1).max(500),
		sentryEventId: z.string().max(64).optional(),
		errorDigest: z.string().max(64).optional(),
		clientContext: clientContextSchema.optional(),
	})
	.strict();

function buildServerContext(request: Request, clientContext?: z.infer<typeof clientContextSchema>) {
	const raw: Record<string, unknown> = {
		userAgent: request.headers.get("user-agent") ?? undefined,
		vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? undefined,
		commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
		...(clientContext ?? {}),
	};
	return scrubFeedbackContext(raw);
}

export async function POST(request: Request) {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ ok: false, message: "Invalid payload." }, { status: 400 });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const [profile] = await db
		.select({ role: profiles.role })
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	const role = profile?.role;
	if (!role || !portalMatchesProfileRole(parsed.data.portal as FeedbackPortal, role)) {
		return Response.json({ ok: false, message: "Portal does not match your account." }, { status: 403 });
	}

	const rl = await consumeFeedbackSubmitRateLimit(user.id);
	if (!rl.ok) {
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return Response.json(
			{ ok: false, message: "You've submitted too many reports recently. Try again later." },
			{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
		);
	}

	const description = scrubFeedbackText(parsed.data.description.trim());
	const title = parsed.data.title?.trim() ? scrubFeedbackText(parsed.data.title.trim()) : null;
	const context = buildServerContext(request, parsed.data.clientContext);

	const { data: row, error } = await supabase
		.from("user_feedback_reports")
		.insert({
			user_id: user.id,
			portal: parsed.data.portal,
			category: parsed.data.category,
			impact: parsed.data.impact ?? null,
			title,
			description,
			page_path: parsed.data.pagePath,
			sentry_event_id: parsed.data.sentryEventId ?? null,
			error_digest: parsed.data.errorDigest ?? null,
			context,
		})
		.select("id")
		.single();

	if (error || !row) {
		if (process.env.NODE_ENV === "development") {
			console.error("[feedback]", error?.message, error?.code, error?.details);
		}
		return Response.json({ ok: false, message: "Could not submit your report." }, { status: 500 });
	}

	return Response.json({ ok: true, reportId: row.id as string });
}
