/**
 * Best-effort client IP from reverse-proxy headers (Vercel / nginx).
 * Truncates to 45 chars for VARCHAR(45) `tests.last_ip`.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
	const xff = headers.get("x-forwarded-for");
	if (xff) {
		const first = xff.split(",")[0]?.trim();
		if (first) return first.slice(0, 45);
	}
	const xReal = headers.get("x-real-ip")?.trim();
	if (xReal) return xReal.slice(0, 45);
	const cf = headers.get("cf-connecting-ip")?.trim();
	if (cf) return cf.slice(0, 45);
	return null;
}
