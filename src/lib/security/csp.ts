import { randomBytes } from "node:crypto";

import { PUBLIC_CSP_SCRIPT_HASHES } from "@/lib/security/public-csp-hashes";

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

function shouldDropUnsafeInlinePortal(): boolean {
	return (
		process.env.VERCEL_ENV === "production" &&
		process.env.PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK === "1"
	);
}

function shouldDropUnsafeInlinePublic(): boolean {
	return shouldDropUnsafeInlinePortal() && PUBLIC_CSP_SCRIPT_HASHES.length > 0;
}

type ScriptSrcOptions = {
	nonce?: string;
	hashes?: readonly string[];
	includeUnsafeInline: boolean;
};

function buildScriptSrcParts(options: ScriptSrcOptions): string[] {
	const isDev = process.env.NODE_ENV !== "production";
	const parts = ["'self'", "'strict-dynamic'"];

	if (options.nonce) {
		parts.push(`'nonce-${options.nonce}'`);
	}

	for (const hash of options.hashes ?? []) {
		parts.push(hash);
	}

	if (options.includeUnsafeInline) {
		parts.push("'unsafe-inline'");
	}

	parts.push("https://checkout.razorpay.com");
	if (isDev) parts.push("'unsafe-eval'");

	return parts;
}

function buildSharedDirectives(scriptSrcParts: string[]): string {
	const connectParts = ["'self'", ...supabaseConnectSources()];
	connectParts.push(
		"https://*.ingest.sentry.io",
		"https://*.ingest.de.sentry.io",
		"https://api.razorpay.com",
	);

	const imgParts = ["'self'", "data:", "blob:", "https://images.unsplash.com"];
	const supabaseImg = supabaseImageOrigin();
	if (supabaseImg) imgParts.push(supabaseImg);

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
	}

	return directives.join("; ");
}

/**
 * Per-request CSP for portals and auth. Uses a nonce for `next-themes` and
 * framework scripts on dynamic routes.
 */
export function buildCsp(nonce: string): string {
	const scriptSrcParts = buildScriptSrcParts({
		nonce,
		includeUnsafeInline: !shouldDropUnsafeInlinePortal(),
	});
	return buildSharedDirectives(scriptSrcParts);
}

/**
 * Stable CSP for ISR marketing/legal pages (no per-request nonce). Inline
 * framework scripts are allowed via `'unsafe-inline'` until
 * {@link PUBLIC_CSP_SCRIPT_HASHES} is populated and
 * `PRODUCTION_DROP_UNSAFE_INLINE_SCRIPT_FALLBACK=1` is enabled.
 */
export function buildPublicMarketingCsp(): string {
	const scriptSrcParts = buildScriptSrcParts({
		hashes: PUBLIC_CSP_SCRIPT_HASHES,
		includeUnsafeInline: !shouldDropUnsafeInlinePublic(),
	});
	return buildSharedDirectives(scriptSrcParts);
}
