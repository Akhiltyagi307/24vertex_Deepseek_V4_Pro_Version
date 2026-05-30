import { z } from "zod";

import { db } from "@/db";
import { moderationFlags } from "@/db/schema/moderation-flags";
import {
	STUDENT_FLAG_QUESTION_LIMIT_N,
	STUDENT_FLAG_QUESTION_WINDOW_SECONDS,
	consumeStudentRateLimit,
} from "@/lib/student/rate-limit";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z
	.object({
		questionId: z.string().uuid(),
		reason: z.string().min(1).max(200),
		notes: z.string().max(4000).optional(),
	})
	.strict();

/**
 * Phase 5: students can report a broken question from the session player.
 * Writes to `question_flags` (RLS: `student_id = auth.uid()`).
 */
export async function POST(request: Request) {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ success: false, ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ success: false, ok: false, message: "Invalid payload." }, { status: 400 });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ success: false, ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "flag-question",
		limitN: STUDENT_FLAG_QUESTION_LIMIT_N,
		windowSeconds: STUDENT_FLAG_QUESTION_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return Response.json(
			{ success: false, ok: false, message: "You've reported too many questions recently. Try again later." },
			{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
		);
	}

	// Gate: question must belong to a test owned by the student. The RLS
	// policy on `questions` already enforces this for reads.
	const { data: qRow } = await supabase
		.from("questions")
		.select("id, test_id")
		.eq("id", parsed.data.questionId)
		.maybeSingle();
	if (!qRow) {
		return Response.json({ success: false, ok: false, message: "Question not found." }, { status: 404 });
	}

	const { error } = await supabase.from("question_flags").insert({
		question_id: parsed.data.questionId,
		student_id: user.id,
		reason: parsed.data.reason,
		notes: parsed.data.notes ?? null,
	});

	if (error) {
		logSupabaseError("flag-question.insert", error, {
			questionId: parsed.data.questionId,
			userId: user.id,
		});
		return Response.json({ success: false, ok: false, message: "Could not submit your report." }, { status: 500 });
	}

	try {
		await db.insert(moderationFlags).values({
			entityType: "question",
			entityId: parsed.data.questionId,
			reportedBy: user.id,
			source: "user",
			reason: parsed.data.notes ? `${parsed.data.reason} — ${parsed.data.notes}` : parsed.data.reason,
			severity: "medium",
			status: "open",
		});
	} catch (e) {
		logServerError("flag-question.moderation_flags", e, {
			questionId: parsed.data.questionId,
			userId: user.id,
		});
	}

	return Response.json({ ok: true });
}
