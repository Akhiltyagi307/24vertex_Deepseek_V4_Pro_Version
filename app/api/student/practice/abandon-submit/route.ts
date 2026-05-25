import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { assertTestOwnedByStudent, executePracticeTestSubmit } from "@/lib/practice/submit-practice-shared";
import {
	STUDENT_PRACTICE_ABANDON_LIMIT_N,
	STUDENT_PRACTICE_ABANDON_WINDOW_SECONDS,
	consumeStudentRateLimit,
} from "@/lib/student/rate-limit";

const bodySchema = z
	.object({
		testId: z.string().uuid(),
		elapsedSeconds: z.number().int().min(0).max(86400),
	})
	.strict();

/**
 * Same grading + submit as the server action, for navigator.sendBeacon / fetch keepalive on unload.
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

	const user = await getServerUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const rl = await consumeStudentRateLimit({
		userId: user.id,
		bucket: "practice-abandon",
		limitN: STUDENT_PRACTICE_ABANDON_LIMIT_N,
		windowSeconds: STUDENT_PRACTICE_ABANDON_WINDOW_SECONDS,
	});
	if (!rl.ok) {
		const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
		return Response.json(
			{ ok: false, message: "Too many submit attempts. Try again shortly." },
			{ status: 429, headers: { "Retry-After": String(retryAfterSec) } },
		);
	}

	const supabase = await createClient();

	const owned = await assertTestOwnedByStudent(supabase, parsed.data.testId, user.id, {
		status: ["in_progress", "grading", "grading_failed"],
	});
	if (!owned.ok) {
		return Response.json({ ok: false, message: owned.message }, { status: 403 });
	}

	const result = await executePracticeTestSubmit(
		supabase,
		user.id,
		parsed.data.testId,
		parsed.data.elapsedSeconds,
	);

	return Response.json(result, { status: result.ok ? 200 : 400 });
}
