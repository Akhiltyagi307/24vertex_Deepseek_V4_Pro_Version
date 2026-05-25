/**
 * Pathnames that receive the static marketing CSP (no per-request script nonce).
 * Portal and auth routes use {@link buildCsp} with a nonce instead.
 */

const PUBLIC_MARKETING_PREFIXES = [
	"/legal/",
	"/pricing",
	"/help",
	"/about",
	"/contact",
	"/students",
	"/parents",
	"/schools",
	"/teachers",
	"/security",
	"/adaptive-practice",
	"/assignments",
	"/ai-tutor",
	"/parent-dashboard",
	"/guides",
	"/blog",
	"/boards/",
	"/grades/",
	"/subjects/",
	"/vs/",
] as const;

function normalizePathname(pathname: string): string {
	if (!pathname || pathname === "/") return "/";
	const trimmed = pathname.replace(/\/+$/, "") || "/";
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * True for ISR marketing/legal pages under `app/(public)/`.
 * Excludes auth (`/login`, `/signup/*`) and all authenticated portals.
 */
export function isPublicMarketingCspPath(pathname: string): boolean {
	const path = normalizePathname(pathname);

	if (path === "/") return true;

	if (path === "/login" || path.startsWith("/signup")) return false;

	if (
		path.startsWith("/student") ||
		path.startsWith("/parent") ||
		path.startsWith("/teacher") ||
		path.startsWith("/admin") ||
		path.startsWith("/api/")
	) {
		return false;
	}

	if (path.startsWith("/dev/marketing")) return true;

	for (const prefix of PUBLIC_MARKETING_PREFIXES) {
		if (path === prefix.replace(/\/$/, "") || path.startsWith(prefix)) {
			return true;
		}
	}

	return false;
}
