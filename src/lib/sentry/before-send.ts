/**
 * PII scrubber for Sentry events. Shared across sentry.{server,client,edge}
 * configs so server-side, browser-side, and edge events all redact the same
 * categories of data.
 *
 * Important: this file must work in all three runtimes (Node, browser, edge),
 * so it cannot import "server-only" or use Node-only globals. No SDK imports
 * either — types are loose so the same shape works regardless of which Sentry
 * minor version is installed.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const SENSITIVE_HEADER_KEYS = new Set([
	"authorization",
	"cookie",
	"set-cookie",
	"proxy-authorization",
	"x-razorpay-signature",
	"x-resend-signature",
	"x-vercel-jwt",
	"x-supabase-auth",
	"x-api-key",
	"apikey",
]);

function redactEmails(s: string): string {
	return s.replace(EMAIL_RE, "[email]");
}

function scrubHeaders(headers: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(headers)) {
		if (SENSITIVE_HEADER_KEYS.has(k.toLowerCase())) {
			out[k] = "[redacted]";
			continue;
		}
		out[k] = typeof v === "string" ? redactEmails(v) : v;
	}
	return out;
}

/**
 * Drop request body / query string / cookies (could contain prompts, answers,
 * payment payloads, tokens), redact sensitive headers, redact emails inside
 * breadcrumb messages, and remove user.email if it slipped in via the SDK's
 * automatic user enrichment.
 *
 * Loosely typed (`unknown` parameter) so the same helper accepts the slightly
 * different ErrorEvent / TransactionEvent shapes that the Sentry SDK passes to
 * beforeSend across runtimes. Mutates in place and returns the input.
 */
export function scrubSentryEvent<T>(event: T): T {
	const e = event as unknown as {
		request?: {
			data?: unknown;
			query_string?: unknown;
			cookies?: unknown;
			headers?: Record<string, unknown>;
		};
		breadcrumbs?: Array<{ message?: string }>;
		user?: { email?: string };
		message?: string;
	};
	if (e.request) {
		if (e.request.data !== undefined) e.request.data = "[redacted]";
		if (e.request.query_string !== undefined) e.request.query_string = "[redacted]";
		if (e.request.cookies !== undefined) e.request.cookies = "[redacted]";
		if (e.request.headers) {
			e.request.headers = scrubHeaders(e.request.headers);
		}
	}

	if (Array.isArray(e.breadcrumbs)) {
		for (const b of e.breadcrumbs) {
			if (typeof b.message === "string") b.message = redactEmails(b.message);
		}
	}

	if (e.user && e.user.email !== undefined) {
		e.user.email = "[redacted]";
	}

	if (typeof e.message === "string") {
		e.message = redactEmails(e.message);
	}

	return event;
}

/**
 * Sentry SDK noise we never want to ingest. Mostly internal Next dev-frames
 * and browser extension origins that produce uncontrollable error volume.
 */
export const SENTRY_DENY_URLS: (string | RegExp)[] = [
	/__nextjs_original-stack-frame/,
	/^chrome-extension:\/\//,
	/^moz-extension:\/\//,
	/^safari-extension:\/\//,
	/^safari-web-extension:\/\//,
];
