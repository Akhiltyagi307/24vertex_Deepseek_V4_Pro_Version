import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { adminSessionCookieDescriptor, revokeAdminSessionByJti } from "@/lib/admin/login-core";
import { adminAckResponse } from "@/lib/admin/response";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

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
				await writeAdminAction({ action: ADMIN_ACTIONS.LOGOUT, payload: {} });
			}
		}

		const res = adminAckResponse();
		res.cookies.set(name, "", cleared);
		return res;
	});
}
