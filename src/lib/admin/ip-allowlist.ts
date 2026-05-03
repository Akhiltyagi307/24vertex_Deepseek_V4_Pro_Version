import "server-only";

/**
 * Next.js route handlers often have no X-Forwarded-For / X-Real-IP locally, so client IP is
 * unknown (0.0.0.0) or headers are missing (null). In production, the platform sets these.
 */
function isLocalDevUnknownClientIp(ip: string | null | undefined): boolean {
	if (process.env.NODE_ENV === "production") return false;
	const v = typeof ip === "string" ? ip.trim() : "";
	if (ip == null || v === "") return true;
	if (v === "0.0.0.0") return true;
	if (v === "::1" || v === "127.0.0.1" || v === "::ffff:127.0.0.1") return true;
	return false;
}

/**
 * Platforms often send IPv4-mapped IPv6 (`::ffff:203.0.113.1`). Allowlists are usually plain IPv4,
 * so normalize for comparison only.
 */
export function normalizeIpForAllowlist(ip: string): string {
	const t = ip.trim();
	const lower = t.toLowerCase();
	if (lower.startsWith("::ffff:") && t.includes(".")) {
		return t.slice("::ffff:".length);
	}
	return t;
}

/** Optional comma-separated IPv4/IPv6 literals (no CIDR parsing in Phase 1). */
export function isAdminIpAllowed(ip: string | null | undefined): boolean {
	const raw = process.env.ADMIN_IP_ALLOWLIST?.trim();
	if (!raw) return true;
	if (isLocalDevUnknownClientIp(ip)) return true;
	// `next start` (or any Node without X-Forwarded-For) often yields `0.0.0.0` from
	// `clientIpFromRequest` — that address will never match a real public allowlist entry.
	// Set ADMIN_LOGIN_ALLOW_UNKNOWN_IP=1 only for trusted local/staging where you still
	// want an allowlist for “real” clients once a proxy is added.
	const v = typeof ip === "string" ? ip.trim() : "";
	const unknownClient = v === "" || v === "0.0.0.0";
	if (
		unknownClient &&
		(process.env.ADMIN_LOGIN_ALLOW_UNKNOWN_IP === "1" || process.env.ADMIN_LOGIN_ALLOW_UNKNOWN_IP === "true")
	) {
		return true;
	}
	if (!ip) return false;
	const allowed = new Set(
		raw
			.split(",")
			.map((s) => normalizeIpForAllowlist(s))
			.filter(Boolean),
	);
	return allowed.has(normalizeIpForAllowlist(ip.trim()));
}
