import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
	assertTestOwnedInProgress,
	writeStudentAnswerRow,
} from "@/lib/practice/submit-practice-shared";

const studentAnswerPayloadSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("mcq"), value: z.string().max(8) }),
	z.object({ kind: z.literal("text"), value: z.string().max(16_000) }),
	z.object({ kind: z.literal("numerical"), value: z.string().max(200) }),
]);

const batchSchema = z.object({
	testId: z.string().uuid(),
	items: z
		.array(
			z.object({
				questionId: z.string().uuid(),
				studentAnswer: studentAnswerPayloadSchema,
				flaggedForReview: z.boolean(),
			}),
		)
		.min(1)
		.max(400),
});

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

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

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

		const { error: upErr } = await writeStudentAnswerRow(supabase, {
			test_id: parsed.data.testId,
			question_id: item.questionId,
			student_answer: item.studentAnswer,
			flagged_for_review: item.flaggedForReview,
			updated_at: new Date().toISOString(),
		});

		if (upErr) {
			if (process.env.NODE_ENV === "development") {
				console.error("[batch-upsert-answers]", upErr.message, upErr.code, upErr.details);
			}
			return Response.json({ ok: false, message: friendlyError() }, { status: 500 });
		}
	}

	return Response.json({ ok: true as const });
}
