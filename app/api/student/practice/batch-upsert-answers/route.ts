import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import {
	assertTestOwnedInProgress,
	writeStudentAnswerRows,
} from "@/lib/practice/submit-practice-shared";
import type { StudentAnswerWriteRow } from "@/lib/practice/student-answer-write";
import {
	STUDENT_PRACTICE_BATCH_UPSERT_LIMIT_N,
	STUDENT_PRACTICE_BATCH_UPSERT_WINDOW_SECONDS,
	consumeStudentRateLimit,
} from "@/lib/student/rate-limit";

const studentAnswerPayloadSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("mcq"), value: z.string().max(8) }).strict(),
	z.object({ kind: z.literal("text"), value: z.string().max(16_000) }).strict(),
	z.object({ kind: z.literal("numerical"), value: z.string().max(200) }).strict(),
]);

const batchSchema = z
	.object({
		testId: z.string().uuid(),
		items: z
			.array(
				z
					.object({
						questionId: z.string().uuid(),
						studentAnswer: studentAnswerPayloadSchema,
						flaggedForReview: z.boolean(),
						timeSpentMs: z.number().int().min(0).max(30 * 60_000).optional(),
						visits: z.number().int().min(0).max(10_000).optional(),
					})
					.strict(),
			)
			.min(1)
			.max(400),
	})
	.strict();

function friendlyError(): string {
	return "We couldn’t save your progress. Try again when you are back online.";
}

/**
 * Batch upsert for practice answers — used for tab close / unload (keepalive / sendBeacon)
 * and for flushing full state when connectivity returns.
 */
export async function POST(request: Request) {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = batchSchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ ok: false, message: "Invalid payload." }, { status: 400 });
	}

	const user = await getServerUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "practice-batch-upsert",
		limitN: STUDENT_PRACTICE_BATCH_UPSERT_LIMIT_N,
		windowSeconds: STUDENT_PRACTICE_BATCH_UPSERT_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return Response.json(
			{ ok: false, message: "Too many save attempts. Try again shortly." },
			{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
		);
	}

	const supabase = await createClient();

	const gate = await assertTestOwnedInProgress(supabase, parsed.data.testId, user.id);
	if (!gate.ok) {
		return Response.json(gate, { status: 400 });
	}

	const { data: qRows, error: qErr } = await supabase
		.from("questions")
		.select("id, question_type")
		.eq("test_id", parsed.data.testId);

	if (qErr || !qRows?.length) {
		return Response.json({ ok: false, message: "Questions not found." }, { status: 400 });
	}

	const qTypes = new Map(qRows.map((r) => [r.id as string, r.question_type as string]));
	const nowIso = new Date().toISOString();
	const testId = parsed.data.testId;

	const writeRows: StudentAnswerWriteRow[] = [];
	for (const item of parsed.data.items) {
		const qt = qTypes.get(item.questionId);
		if (!qt) {
			return Response.json({ ok: false, message: "Question not in this test." }, { status: 400 });
		}
		const expectedKind =
			qt === "multiple_choice" ? "mcq"
			: qt === "numerical" ? "numerical"
			: "text";
		if (item.studentAnswer.kind !== expectedKind) {
			return Response.json({ ok: false, message: "Answer type mismatch." }, { status: 400 });
		}
		writeRows.push({
			test_id: testId,
			question_id: item.questionId,
			student_answer: item.studentAnswer,
			flagged_for_review: item.flaggedForReview,
			updated_at: nowIso,
			time_spent_ms: item.timeSpentMs ?? null,
			visits: item.visits ?? null,
		});
	}

	const { error: upErr } = await writeStudentAnswerRows(supabase, writeRows);
	if (upErr) {
		if (process.env.NODE_ENV === "development") {
			console.error("[batch-upsert-answers]", upErr.message, upErr.code, upErr.details);
		}
		return Response.json({ ok: false, message: friendlyError() }, { status: 500 });
	}

	return Response.json({ ok: true as const });
}
