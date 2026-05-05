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

/**
 * Plain `local@domain.tld` — catches the common case in error messages,
 * stack frames, and free-text breadcrumb messages.
 */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/**
 * URL-encoded `%40` form. Browsers encode `@` in query strings even when
 * navigating from a regular form (`?email=foo%40bar.com`). Without this,
 * a Sentry breadcrumb generated from a request URL leaked the raw user
 * email despite EMAIL_RE catching the unencoded form.
 */
const EMAIL_URL_ENCODED_RE = /[A-Z0-9._%+-]+%40[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/**
 * Bare `email=value` query param. Catches the case where the value isn't
 * URL-encoded (some clients pass through). Pairs with EMAIL_URL_ENCODED_RE
 * which handles the encoded path.
 */
const EMAIL_QUERY_PARAM_RE = /(\b(?:email|user_email|recipient)=)[^&\s]+/gi;

const USER_ID_HASH_PREFIX = "usr_";

/**
 * Tiny non-cryptographic 32-bit hash (FNV-1a). We don't need crypto strength —
 * a single Sentry event tagged with `user.id` is enough to reidentify a
 * student given access to the production DB, so the only goal is to make
 * the value useless without a corresponding lookup table that we never
 * publish. FNV-1a is small, dependency-free, deterministic, and runs in
 * Node, browser, and Edge runtimes alike (no Web Crypto async API).
 *
 * Same input → same output, so multiple events from one user still cluster
 * in Sentry under the hashed id; that's the property we want to keep.
 */
function fnv1a32(input: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		// Equivalent to multiplying by 16777619, kept in 32-bit using `Math.imul`
		// which works in both Node and browsers including Edge.
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hash a user id (UUID, email-like string, anything) so Sentry events stay
 * groupable per-user without storing the raw identifier. A UUID hashed with
 * FNV produces an 8-char hex like `usr_3f1c4a7b`. Combined with already
 * redacting `user.email`, an event leaks no direct PII even if the project
 * is breached.
 */
export function hashUserIdForSentry(rawId: string): string {
	if (!rawId) return rawId;
	return USER_ID_HASH_PREFIX + fnv1a32(rawId);
}

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
	return s
		.replace(EMAIL_RE, "[email]")
		.replace(EMAIL_URL_ENCODED_RE, "[email]")
		.replace(EMAIL_QUERY_PARAM_RE, "$1[redacted]");
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
		user?: { id?: string; email?: string; ip_address?: string; username?: string };
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

	// User identifiers: redact email/username outright; hash user.id and
	// ip_address so events still cluster per-user but the raw values never
	// reach Sentry storage. Previously `user.id` (a UUID) was logged verbatim,
	// which combined with timestamp + path is enough to re-identify a student.
	if (e.user) {
		if (typeof e.user.id === "string" && e.user.id.length > 0) {
			e.user.id = hashUserIdForSentry(e.user.id);
		}
		if (e.user.email !== undefined) e.user.email = "[redacted]";
		if (e.user.username !== undefined) e.user.username = "[redacted]";
		if (typeof e.user.ip_address === "string" && e.user.ip_address.length > 0) {
			// Hash IP too — same reasoning. Sentry can still group "events from
			// this network" without storing the raw v4/v6 address.
			e.user.ip_address = hashUserIdForSentry(e.user.ip_address);
		}
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
