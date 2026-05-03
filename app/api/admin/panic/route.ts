import { type NextRequest, NextResponse } from "next/server";

import { writeAdminAction } from "@/lib/admin/audit";
import { bumpAdminJwtVersion } from "@/lib/admin/runtime-pg";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const token = request.nextUrl.searchParams.get("token");
		const expected = process.env.ADMIN_PANIC_TOKEN?.trim();
		if (!expected || token !== expected) {
			return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403, headers: adminHeaders() });
		}

		const v = await bumpAdminJwtVersion();
		await writeAdminAction({ action: "panic_revoke_all", payload: { jwt_version: v } });

		const to = process.env.ADMIN_EMAIL?.trim();
		if (to) {
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
		}

		return NextResponse.json({ ok: true, jwt_version: v }, { headers: adminHeaders() });
	});
}
