import "server-only";

function allowlistEntries(): string[] | null {
	const raw = process.env.ADMIN_IP_ALLOWLIST;
	if (raw == null) return null;
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	const entries = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
	if (entries.length === 0) return null;
	return entries;
}

/**
 * When `ADMIN_IP_ALLOWLIST` is unset or blank, all client IPs are allowed.
 * Otherwise only exact IPs in the comma-separated list (after trimming each entry)
 * may access admin login. In production, the sentinel IP `0.0.0.0` is denied when
 * the allowlist is set unless `ADMIN_LOGIN_ALLOW_UNKNOWN_IP=1`.
 */
export function isAdminIpAllowed(ip: string): boolean {
	const list = allowlistEntries();
	if (list == null) return true;

	const normalized = typeof ip === "string" ? ip.trim() : "";

	if (process.env.NODE_ENV === "production" && normalized === "0.0.0.0") {
		return process.env.ADMIN_LOGIN_ALLOW_UNKNOWN_IP === "1";
	}

	return list.includes(normalized);
}
