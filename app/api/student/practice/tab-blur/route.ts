import { z } from "zod";

import { assertTestOwnedInProgress } from "@/lib/practice/submit-practice-shared";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
	testId: z.string().uuid(),
});

/**
 * Throttled client beacon: increments `tests.tab_blur_count` for anomaly / live monitor signals.
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

	const gate = await assertTestOwnedInProgress(supabase, parsed.data.testId, user.id);
	if (!gate.ok) {
		return Response.json({ ok: false, message: gate.message }, { status: 403 });
	}

	const { data: row, error: selErr } = await supabase
		.from("tests")
		.select("tab_blur_count")
		.eq("id", parsed.data.testId)
		.maybeSingle();

	if (selErr) {
		return Response.json({ ok: false, message: "Could not read test." }, { status: 500 });
	}

	const next = Number((row as { tab_blur_count?: number } | null)?.tab_blur_count ?? 0) + 1;
	const { error: upErr } = await supabase
		.from("tests")
		.update({ tab_blur_count: next, updated_at: new Date().toISOString() })
		.eq("id", parsed.data.testId)
		.eq("student_id", user.id);

	if (upErr) {
		return Response.json({ ok: false, message: "Could not update test." }, { status: 500 });
	}

	return Response.json({ ok: true });
}
