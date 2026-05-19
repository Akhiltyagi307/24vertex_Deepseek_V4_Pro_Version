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

	// D4 (img-src tightening): replace the previous blanket `https:` with an
	// explicit allowlist that mirrors `next.config.ts` `images.remotePatterns`.
	// `data:` keeps base64 placeholders working (next/image, OG previews);
	// `blob:` covers in-app generated thumbnails (e.g. doubt-chat attachment
	// previews before upload). Add new origins here AND to `remotePatterns`
	// in `next.config.ts` so the optimizer and the browser agree.
	const imgParts = ["'self'", "data:", "blob:", "https://images.unsplash.com"];
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

	// Opt-in production knob to drop the `'unsafe-inline'` legacy fallback.
	// Modern browsers ignore `'unsafe-inline'` whenever `'strict-dynamic'` is
	// present, so removing it changes nothing in evergreen Chrome/Firefox/Safari
	// — but legacy browsers (Chrome <70, Safari <15) that don't recognise
	// `'strict-dynamic'` will start refusing inline `<script>` tags. Default off
	// so the operator deliberately confirms legacy support is no longer needed.
	// To revert: unset PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK.
	if (
		process.env.VERCEL_ENV === "production" &&
		process.env.PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK === "1"
	) {
		const filtered = scriptSrcParts.filter((part) => part !== "'unsafe-inline'");
		scriptSrcParts.length = 0;
		scriptSrcParts.push(...filtered);
	}

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
		// `require-trusted-types-for 'script'` was removed: the original comment
		// claimed innerHTML/outerHTML were unconstrained by the `'script'`
		// keyword, but the Trusted Types spec defines the keyword as covering
		// every TrustedHTML / TrustedScript / TrustedScriptURL sink — including
		// Element.innerHTML. Tiptap, MJML render output, next-themes' inline
		// pre-hydration `<script>`, recharts SVG defs, and Sentry replays all
		// assign raw strings to these sinks, which made every client-side
		// hydration throw a TypeError caught by the route-level error boundary.
		// Re-enabling this needs a real default `trustedTypes.createPolicy`
		// shim (in a top-level client island) plus a per-library audit; until
		// then keep prod working.
	}

	return directives.join("; ");
}
