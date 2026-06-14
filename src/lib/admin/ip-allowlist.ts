import "server-only";

import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";

function allowlistEntries(): string[] | null {
	const raw = process.env.ADMIN_IP_ALLOWLIST;
	if (raw == null) return null;
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	const entries = trimmed
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (entries.length === 0) return null;
	return entries;
}

/**
 * D7: CIDR + IPv6 support for the admin IP allowlist.
 *
 * Each entry in `ADMIN_IP_ALLOWLIST` is one of:
 *   - exact IPv4 (`203.0.113.1`)
 *   - exact IPv6 (`2001:db8::1`, case-insensitive, `::` expansion supported)
 *   - IPv4 CIDR (`203.0.113.0/24`)
 *   - IPv6 CIDR (`2001:db8::/32`)
 *
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is treated as the underlying IPv4
 * so requests arriving over an IPv6 socket against a v4 allowlist still
 * match. The implementation is inline (no extra dependency) and falls
 * back to literal string match for entries that can't be parsed (back-
 * compat with operator typos).
 */

type ParsedIp = { kind: "v4" | "v6"; num: bigint };

function parseIpv4(addr: string): bigint | null {
	const parts = addr.split(".");
	if (parts.length !== 4) return null;
	let n = 0n;
	for (const p of parts) {
		if (!/^\d{1,3}$/.test(p)) return null;
		const v = Number(p);
		if (v < 0 || v > 255) return null;
		n = (n << 8n) | BigInt(v);
	}
	return n;
}

function parseIpv6(addr: string): bigint | null {
	let s = addr.toLowerCase();
	// Strip zone id (`%eth0` etc.) — not address-significant for allowlist matching.
	const zoneIdx = s.indexOf("%");
	if (zoneIdx !== -1) s = s.slice(0, zoneIdx);

	// Embedded IPv4 form, e.g. `::ffff:1.2.3.4`. Replace with two pseudo groups
	// and OR the IPv4 number back into the low 32 bits after the group parse.
	let v4Suffix: bigint | null = null;
	const lastColon = s.lastIndexOf(":");
	if (lastColon !== -1 && s.slice(lastColon + 1).includes(".")) {
		const v4Part = s.slice(lastColon + 1);
		v4Suffix = parseIpv4(v4Part);
		if (v4Suffix === null) return null;
		s = `${s.slice(0, lastColon + 1)}0:0`;
	}

	// Only one `::` allowed; expand to fill exactly 8 groups.
	const doubleColonCount = (s.match(/::/g) ?? []).length;
	if (doubleColonCount > 1) return null;

	let groups: string[];
	if (doubleColonCount === 1) {
		const [left, right] = s.split("::");
		const leftParts = left === "" ? [] : left.split(":");
		const rightParts = right === "" ? [] : right.split(":");
		const fill = 8 - leftParts.length - rightParts.length;
		if (fill < 0) return null;
		groups = [...leftParts, ...Array(fill).fill("0"), ...rightParts];
	} else {
		groups = s.split(":");
	}

	if (groups.length !== 8) return null;

	let n = 0n;
	for (const g of groups) {
		if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
		const v = Number.parseInt(g, 16);
		if (v < 0 || v > 0xffff) return null;
		n = (n << 16n) | BigInt(v);
	}

	if (v4Suffix !== null) {
		// Low 32 bits are zero (we replaced the embedded v4 with `0:0`); OR them in.
		n = (n & ~0xffffffffn) | v4Suffix;
	}

	return n;
}

function parseIp(addr: string): ParsedIp | null {
	const trimmed = addr.trim();
	if (trimmed === "") return null;

	// IPv4-mapped IPv6 — fold into v4 representation so a v4 allowlist matches.
	if (/^::ffff:/i.test(trimmed) && trimmed.slice(7).includes(".")) {
		const v4 = parseIpv4(trimmed.slice(7));
		if (v4 !== null) return { kind: "v4", num: v4 };
	}

	if (trimmed.includes(":")) {
		const n = parseIpv6(trimmed);
		if (n !== null) return { kind: "v6", num: n };
	}
	if (trimmed.includes(".")) {
		const n = parseIpv4(trimmed);
		if (n !== null) return { kind: "v4", num: n };
	}
	return null;
}

function parseCidr(entry: string): { kind: "v4" | "v6"; base: bigint; mask: bigint } | null {
	const idx = entry.indexOf("/");
	if (idx === -1) return null;
	const addrPart = entry.slice(0, idx);
	const lenStr = entry.slice(idx + 1);
	if (!/^\d+$/.test(lenStr)) return null;
	const len = Number(lenStr);

	const parsed = parseIp(addrPart);
	if (parsed === null) return null;

	const total = parsed.kind === "v4" ? 32 : 128;
	if (len < 0 || len > total) return null;

	const mask = len === 0 ? 0n : ((1n << BigInt(len)) - 1n) << BigInt(total - len);
	return { kind: parsed.kind, base: parsed.num & mask, mask };
}

function entryMatches(entry: string, requestIp: ParsedIp): boolean {
	if (entry.includes("/")) {
		const cidr = parseCidr(entry);
		if (cidr === null) return false;
		if (cidr.kind !== requestIp.kind) return false;
		return (requestIp.num & cidr.mask) === cidr.base;
	}
	const exact = parseIp(entry);
	if (exact === null) return false;
	if (exact.kind !== requestIp.kind) return false;
	return exact.num === requestIp.num;
}

/**
 * When `ADMIN_IP_ALLOWLIST` is unset or blank, all client IPs are allowed.
 * Otherwise the request IP must match one entry — exact IP or CIDR range,
 * IPv4 or IPv6. In production, the sentinel IP `0.0.0.0` (signals an
 * unresolved client IP) is denied when the allowlist is set unless
 * `ADMIN_LOGIN_ALLOW_UNKNOWN_IP=1`. Precedence: first matching entry wins.
 */
export function isAdminIpAllowed(ip: string): boolean {
	const list = allowlistEntries();
	if (list == null) return true;

	const normalized = typeof ip === "string" ? ip.trim() : "";

	if (process.env.NODE_ENV === "production" && normalized === "0.0.0.0") {
		return process.env.ADMIN_LOGIN_ALLOW_UNKNOWN_IP === "1";
	}

	const parsed = parseIp(normalized);
	if (parsed === null) {
		// Couldn't parse the request IP. Fall back to literal string match so
		// operators can still allowlist non-IP strings (e.g., explicit "unknown")
		// if they really want to. This preserves the pre-D7 behavior for any
		// edge case we haven't anticipated.
		return list.includes(normalized);
	}

	for (const entry of list) {
		if (entryMatches(entry, parsed)) return true;
	}
	return false;
}

/**
 * Request-time wrapper: resolve the client IP from proxy/platform headers and
 * check it against the allowlist. Used by the Node-runtime admin guards
 * (`requireAdminApi`, `requireAdmin`) so the allowlist gates every admin request,
 * not just login — a stolen session cookie is then unusable off-network. A no-op
 * (returns true) when `ADMIN_IP_ALLOWLIST` is unset.
 */
export function isAdminRequestIpAllowed(h: Headers): boolean {
	return isAdminIpAllowed(clientIpFromHeaders(h));
}
