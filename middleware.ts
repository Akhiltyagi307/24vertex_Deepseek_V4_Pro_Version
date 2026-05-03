import { type NextRequest, NextResponse } from "next/server";

import { shouldRedirectToMaintenance } from "@/lib/admin/maintenance-routing";
import { adminProxyGate } from "@/lib/admin/proxy-guard";
import { updateSession } from "@/lib/supabase/session";

/** Node.js runtime: matches prior `proxy.ts` behavior and ensures dev emits `server/middleware.js` (Turbopack + `loadNodeMiddleware`). */
export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const adminEarly = await adminProxyGate(request);
	if (adminEarly) {
		return adminEarly;
	}

	if (shouldRedirectToMaintenance(pathname, process.env.MAINTENANCE_MODE)) {
		const url = request.nextUrl.clone();
		url.pathname = "/maintenance";
		return NextResponse.redirect(url);
	}

	return updateSession(request);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
