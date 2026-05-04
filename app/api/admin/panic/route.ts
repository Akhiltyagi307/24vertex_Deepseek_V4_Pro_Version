import { type NextRequest, NextResponse } from "next/server";

import { writeAdminAction } from "@/lib/admin/audit";
import { bumpAdminJwtVersion } from "@/lib/admin/runtime-pg";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";
import { getAdminNotificationRecipients } from "@/lib/env";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

/**
 * Reads the admin panic token from a request header — never the URL query —
 * because URL parameters are written to Vercel/edge access logs and would
 * otherwise leak the secret. Accepts either:
 *
 *   Authorization: Bearer <token>
 *   X-Admin-Panic-Token: <token>
 *
 * Returns the token (already trimmed) when present, or `null`.
 */
function readPanicTokenFromHeaders(request: NextRequest): string | null {
	const auth = request.headers.get("authorization");
	if (auth) {
		const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
		if (match) return match[1].trim();
	}
	const direct = request.headers.get("x-admin-panic-token");
	if (direct) return direct.trim();
	return null;
}

export async function POST(request: NextRequest) {
	return handlePanic(request);
}

// GET kept for browser-based emergency invocation. Token still must come from
// a header — supply it via curl `-H` or the equivalent admin tool, never as a
// query string.
export async function GET(request: NextRequest) {
	return handlePanic(request);
}

async function handlePanic(request: NextRequest): Promise<NextResponse> {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");

		const token = readPanicTokenFromHeaders(request);
		const expected = process.env.ADMIN_PANIC_TOKEN?.trim();
		if (!expected || !token || token !== expected) {
			return NextResponse.json(
				{ error: "Forbidden", code: "forbidden" },
				{ status: 403, headers: adminHeaders() },
			);
		}

		const v = await bumpAdminJwtVersion();
		await writeAdminAction({ action: "panic_revoke_all", payload: { jwt_version: v } });

		const recipients = getAdminNotificationRecipients();
		await Promise.allSettled(
			recipients.map(async (to) => {
				try {
					await sendHtmlEmailLogged({
						to,
						subject: "EduAI admin panic — all sessions invalidated",
						html: `<p>All admin JWTs were invalidated (version ${v}).</p>`,
						templateSlug: "admin-panic",
						templateVariables: { jwt_version: String(v) },
					});
				} catch (e) {
					Sentry.captureException(e);
				}
			}),
		);

		return NextResponse.json({ ok: true, jwt_version: v }, { headers: adminHeaders() });
	});
}
