import { randomBytes } from "node:crypto";

export const CSP_NONCE_REQUEST_HEADER = "x-nonce";

export function generateCspNonce(): string {
	return randomBytes(16).toString("base64");
}

function supabaseConnectSources(): string[] {
	const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!raw) return [];
	try {
		const u = new URL(raw);
		return [u.origin, `wss://${u.hostname}`];
	} catch {
		return [];
	}
}

function supabaseImageOrigin(): string | null {
	const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!raw) return null;
	try {
		return new URL(raw).origin;
	} catch {
		return null;
	}
}

/**
 * Per-request CSP. `'strict-dynamic'` + `'nonce-…'` allow Next.js framework scripts (which receive
 * the nonce automatically) and any scripts those bundles dynamically inject — including the
 * Razorpay checkout SDK loaded via `document.createElement('script')`. Modern browsers ignore
 * `'unsafe-inline'` and the host whitelist while `'strict-dynamic'` is present; both are kept
 * as fallbacks for legacy browsers.
 *
 * `style-src` keeps `'unsafe-inline'` (no nonce) because Radix/Sonner/Tailwind emit unkeyed
 * inline styles at runtime; tightening that needs a separate, library-by-library audit.
 */
export function buildCsp(nonce: string): string {
	const isDev = process.env.NODE_ENV !== "production";

	const connectParts = ["'self'", ...supabaseConnectSources()];
	connectParts.push(
		"https://*.ingest.sentry.io",
		"https://*.ingest.de.sentry.io",
		"https://api.razorpay.com",
	);

	const imgParts = ["'self'", "data:", "blob:", "https:"];
	const supabaseImg = supabaseImageOrigin();
	if (supabaseImg) imgParts.push(supabaseImg);

	const scriptSrcParts = [
		"'self'",
		"'strict-dynamic'",
		`'nonce-${nonce}'`,
		"'unsafe-inline'",
		"https://checkout.razorpay.com",
	];
	if (isDev) scriptSrcParts.push("'unsafe-eval'");

	const directives = [
		"default-src 'self'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'self'",
		`script-src ${scriptSrcParts.join(" ")}`,
		"style-src 'self' 'unsafe-inline'",
		`connect-src ${connectParts.join(" ")}`,
		`img-src ${imgParts.join(" ")}`,
		"font-src 'self' data:",
		"frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
	];

	if (process.env.VERCEL_ENV === "production") {
		directives.push("upgrade-insecure-requests");
		// Trusted Types for script-execution sinks (Function constructor, eval).
		// Browsers that don't support TT silently ignore the directive, so this
		// is purely additive. We scope to 'script' (not 'script html'); HTML
		// sinks like innerHTML are NOT constrained because Tiptap, MJML, and a
		// few server-rendered components emit raw HTML strings without going
		// through a TT policy. Restricted to production: Next dev/Turbopack
		// uses `'unsafe-eval'` for HMR (line above) which is incompatible with
		// `require-trusted-types-for 'script'`.
		directives.push("require-trusted-types-for 'script'");
	}

	return directives.join("; ");
}
