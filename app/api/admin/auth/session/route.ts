import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const jar = await cookies();
		const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
		if (!token) {
			return NextResponse.json({ valid: false }, { status: 401, headers: adminHeaders() });
		}
		const payload = await verifyAdminJwt(token);
		if (!payload) {
			return NextResponse.json({ valid: false }, { status: 401, headers: adminHeaders() });
		}
		return NextResponse.json({ valid: true }, { headers: adminHeaders() });
	});
}
