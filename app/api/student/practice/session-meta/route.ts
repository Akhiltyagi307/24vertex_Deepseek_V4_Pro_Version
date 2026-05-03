import { z } from "zod";

import { assertTestOwnedInProgress } from "@/lib/practice/submit-practice-shared";
import { clientIpFromHeaders } from "@/lib/http/client-ip";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
	testId: z.string().uuid(),
	deviceFingerprint: z.string().min(8).max(64).optional(),
});

/**
 * Fills `tests.last_ip` / `tests.device_fingerprint` when still null (live monitor / anomalies).
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
		.select("last_ip, device_fingerprint")
		.eq("id", parsed.data.testId)
		.maybeSingle();

	if (selErr) {
		return Response.json({ ok: false, message: "Could not read test." }, { status: 500 });
	}

	const lastIpHeader = clientIpFromHeaders(request.headers);
	const patch: Record<string, string> = {};
	const curIp = (row as { last_ip?: string | null } | null)?.last_ip;
	const curFp = (row as { device_fingerprint?: string | null } | null)?.device_fingerprint;
	if (!curIp && lastIpHeader) {
		patch.last_ip = lastIpHeader;
	}
	if (!curFp && parsed.data.deviceFingerprint) {
		patch.device_fingerprint = parsed.data.deviceFingerprint;
	}

	if (Object.keys(patch).length === 0) {
		return Response.json({ ok: true, updated: false });
	}

	const { error: upErr } = await supabase
		.from("tests")
		.update({ ...patch, updated_at: new Date().toISOString() })
		.eq("id", parsed.data.testId)
		.eq("student_id", user.id);

	if (upErr) {
		return Response.json({ ok: false, message: "Could not update test." }, { status: 500 });
	}

	return Response.json({ ok: true, updated: true });
}
