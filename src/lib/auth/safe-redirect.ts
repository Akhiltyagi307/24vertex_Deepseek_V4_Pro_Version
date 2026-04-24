/**
 * Resolves a post-login `next` query param to a same-origin path only.
 * Rejects open redirects such as `//evil.com` (protocol-relative URLs).
 */
export function resolveSafeNextPath(next: string | null, origin: string, fallback: string): string {
	if (next == null || next === "") {
		return fallback;
	}
	const trimmed = next.trim();
	// Must be a relative path: single leading slash, not `//` (protocol-relative).
	if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
		return fallback;
	}
	try {
		const resolved = new URL(trimmed, origin);
		const base = new URL(origin);
		if (resolved.origin !== base.origin) {
			return fallback;
		}
		if (resolved.pathname === "" || resolved.pathname === "/") {
			return trimmed === "/" ? "/" : fallback;
		}
		return `${resolved.pathname}${resolved.search}${resolved.hash}`;
	} catch {
		return fallback;
	}
}
