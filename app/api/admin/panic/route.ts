import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { bumpAdminJwtVersion } from "@/lib/admin/runtime-pg";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";
import { getAdminNotificationRecipients } from "@/lib/env";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

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
			return adminErrorResponse("Forbidden", { status: 403, code: "forbidden" });
		}

		const v = await bumpAdminJwtVersion();
		// Strict audit: panic revokes EVERY admin session and is the
		// highest-stakes operator action in the system. A missing audit row
		// here is unacceptable.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.PANIC_REVOKE_ALL,
			payload: { jwt_version: v },
		});

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

		return adminAckResponse({ jwt_version: v });
	});
}
