import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
	questionId: z.string().uuid(),
	reason: z.string().min(1).max(200),
	notes: z.string().max(4000).optional(),
});

/**
 * Phase 5: students can report a broken question from the session player.
 * Writes to `question_flags` (RLS: `student_id = auth.uid()`).
 */
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

	// Gate: question must belong to a test owned by the student. The RLS
	// policy on `questions` already enforces this for reads.
	const { data: qRow } = await supabase
		.from("questions")
		.select("id, test_id")
		.eq("id", parsed.data.questionId)
		.maybeSingle();
	if (!qRow) {
		return Response.json({ ok: false, message: "Question not found." }, { status: 404 });
	}

	const { error } = await supabase.from("question_flags").insert({
		question_id: parsed.data.questionId,
		student_id: user.id,
		reason: parsed.data.reason,
		notes: parsed.data.notes ?? null,
	});

	if (error) {
		if (process.env.NODE_ENV === "development") {
			console.error("[flag-question]", error.message, error.code, error.details);
		}
		return Response.json({ ok: false, message: "Could not submit your report." }, { status: 500 });
	}

	return Response.json({ ok: true });
}
