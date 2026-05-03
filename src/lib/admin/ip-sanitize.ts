import { isIP } from "node:net";

/**
 * Postgres `inet` rejects many header-shaped strings. Use this before writing to `inet` columns
 * (`admin_sessions.ip_address`, `admin_action_log.ip_address`, `admin_login_rate.ip`).
 */
export function clientIpForPostgresInet(ip: string | null | undefined): string | null {
	if (ip == null) return null;
	const t = String(ip).trim();
	if (!t || t === "0.0.0.0") return null;
	if (isIP(t) === 0) return null;
	return t;
}
