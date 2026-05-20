import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { invalidateAdminSessionCache } from "@/lib/admin/api-auth";
import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { adminSessionCookieDescriptor, revokeAdminSessionByJti } from "@/lib/admin/login-core";
import { adminAckResponse } from "@/lib/admin/response";
import {
	maybePruneExpiredAdminSessionRevocations,
	recordAdminSessionRevocation,
} from "@/lib/admin/runtime-pg";
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
				// D10: invalidate the in-process cache for this jti, then write a
				// cross-process tombstone so other Node processes notice within
				// their cache TTL (otherwise a logged-out session could keep
				// passing for up to 10s on a peer process).
				invalidateAdminSessionCache(payload.jti);
				await recordAdminSessionRevocation(payload.jti);
				await maybePruneExpiredAdminSessionRevocations();
				await writeAdminAction({ action: ADMIN_ACTIONS.LOGOUT, payload: {} });
			}
		}

		const res = adminAckResponse();
		res.cookies.set(name, "", cleared);
		return res;
	});
}
