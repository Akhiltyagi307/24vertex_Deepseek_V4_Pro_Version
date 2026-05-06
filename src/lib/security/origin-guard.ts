import type { NextRequest } from "next/server";

/**
 * Defense-in-depth CSRF check for state-changing requests.
 *
 * Browsers always set Origin on cross-origin POST/PUT/PATCH/DELETE; if Origin
 * is set and doesn't match our app's origin, the request is a CSRF attempt
 * and we reject. If Origin is absent (server-to-server fetch, curl, dev
 * tools), we allow — CSRF only applies to browser-driven cross-origin
 * smuggling.
 *
 * Lifted from `lib/admin/proxy-guard` (W2.2) so the same logic gates billing
 * mutating routes (create-subscription, cancel, change-plan, etc.) without
 * duplication. Admin proxy-guard now imports `adminOriginAllowed` from here.
 */
export function originAllowed(request: NextRequest, expectedOriginOverride?: string | null): boolean {
	const origin = request.headers.get("origin")?.trim();
	if (!origin) return true;

	const expected = (expectedOriginOverride ?? process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
	const expectedOrigin = (() => {
		if (!expected) return null;
		try {
			return new URL(expected).origin;
		} catch {
			return null;
		}
	})();

	if (expectedOrigin && origin === expectedOrigin) return true;

	// Same-origin to the request itself is also acceptable (covers preview
	// deployments, custom domains, and the case where NEXT_PUBLIC_APP_URL is
	// unset in dev).
	try {
		const requestOrigin = new URL(request.url).origin;
		if (origin === requestOrigin) return true;
	} catch {
		/* malformed url — fall through to deny */
	}

	return false;
}
