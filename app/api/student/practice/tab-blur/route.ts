import { z } from "zod";

import { assertTestOwnedInProgress } from "@/lib/practice/submit-practice-shared";
import {
	STUDENT_PRACTICE_TAB_BLUR_LIMIT_N,
	STUDENT_PRACTICE_TAB_BLUR_WINDOW_SECONDS,
	consumeStudentRateLimit,
} from "@/lib/student/rate-limit";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z
	.object({
		testId: z.string().uuid(),
	})
	.strict();

/**
 * Throttled client beacon: increments `tests.tab_blur_count` for anomaly / live monitor signals.
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
		bucket: "practice-tab-blur",
		limitN: STUDENT_PRACTICE_TAB_BLUR_LIMIT_N,
		windowSeconds: STUDENT_PRACTICE_TAB_BLUR_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return Response.json(
			{ success: false, ok: false, message: "Too many tab-blur events. Slow down." },
			{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
		);
	}

	const gate = await assertTestOwnedInProgress(supabase, parsed.data.testId, user.id);
	if (!gate.ok) {
		return Response.json({ success: false, ok: false, message: gate.message }, { status: 403 });
	}

	const { data: row, error: selErr } = await supabase
		.from("tests")
		.select("tab_blur_count")
		.eq("id", parsed.data.testId)
		.maybeSingle();

	if (selErr) {
		return Response.json({ success: false, ok: false, message: "Could not read test." }, { status: 500 });
	}

	const next = Number((row as { tab_blur_count?: number } | null)?.tab_blur_count ?? 0) + 1;
	const { error: upErr } = await supabase
		.from("tests")
		.update({ tab_blur_count: next, updated_at: new Date().toISOString() })
		.eq("id", parsed.data.testId)
		.eq("student_id", user.id);

	if (upErr) {
		return Response.json({ success: false, ok: false, message: "Could not update test." }, { status: 500 });
	}

	return Response.json({ ok: true });
}
