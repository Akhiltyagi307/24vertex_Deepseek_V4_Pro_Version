import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { executePracticeTestSubmit } from "@/lib/practice/submit-practice-shared";

const bodySchema = z.object({
	testId: z.string().uuid(),
	elapsedSeconds: z.number().int().min(0).max(86400),
});

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
	const supabase = await createClient();

	const result = await executePracticeTestSubmit(
		supabase,
		user.id,
		parsed.data.testId,
		parsed.data.elapsedSeconds,
	);

	return Response.json(result, { status: result.ok ? 200 : 400 });
}
