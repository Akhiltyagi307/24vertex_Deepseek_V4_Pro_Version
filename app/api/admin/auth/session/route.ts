import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const jar = await cookies();
		const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
		if (!token) {
			return adminErrorResponse("Unauthorized", { status: 401, code: "unauthenticated" });
		}
		const payload = await verifyAdminJwt(token);
		if (!payload) {
			return adminErrorResponse("Unauthorized", { status: 401, code: "unauthenticated" });
		}
		// `{ valid: true }` is the existing client contract — keep the shape but
		// apply canonical headers via `ADMIN_RESPONSE_HEADERS`.
		return NextResponse.json({ valid: true }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
	});
}
