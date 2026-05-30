import { z } from "zod";

import { getApiRequestUser } from "@/lib/auth/api-request-user";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * W7.4 — narrow client-side telemetry endpoint for the billing checkout
 * funnel. Server-side events fire from the webhook processor; this captures
 * the parts that only the browser can see (modal opened, dismissed, payment
 * declined inside the modal).
 *
 * Allowlist of event names is server-enforced so a curious client can't
 * pollute the analytics stream with arbitrary names.
 */
const ALLOWED_EVENTS = [
	"checkout_opened",
	"checkout_dismissed",
	"checkout_payment_failed",
	"checkout_modal_render_failed",
] as const;

const bodySchema = z
	.object({
		event_name: z.enum(ALLOWED_EVENTS),
		props: z.record(z.unknown()).optional(),
	})
	.strict();

export async function POST(req: Request) {
	const auth = await getApiRequestUser(req);
	if (!auth) return Response.json({ success: false, ok: false }, { status: 401 });

	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ success: false, ok: false, message: "Invalid event payload." }, { status: 400 });
	}

	const admin = createServiceRoleClient();
	await admin.from("practice_analytics_events").insert({
		student_id: auth.user.id,
		event_name: parsed.data.event_name,
		props: parsed.data.props ?? {},
	});

	return Response.json({ ok: true });
}
