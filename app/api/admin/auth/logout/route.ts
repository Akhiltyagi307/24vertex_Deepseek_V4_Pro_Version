import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { adminSessionCookieDescriptor, revokeAdminSessionByJti } from "@/lib/admin/login-core";
import { writeAdminAction } from "@/lib/admin/audit";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const jar = await cookies();
		const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
		const { name, options } = adminSessionCookieDescriptor(request);
		const cleared = { ...options, maxAge: 0 };

		if (token) {
			const payload = await verifyAdminJwt(token);
			if (payload) {
				await revokeAdminSessionByJti(payload.jti);
				await writeAdminAction({ action: "logout", payload: {} });
			}
		}

		const res = NextResponse.json({ ok: true }, { headers: adminHeaders() });
		res.cookies.set(name, "", cleared);
		return res;
	});
}
