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

/**
 * JWT-shaped tokens (three base64url segments separated by `.`). The lower
 * bound on each segment guards against false positives like normal
 * `foo.bar.baz` package names. Real JWTs are >> 60 characters total because
 * the header alone is ~16 chars.
 */
const JWT_RE = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;

/**
 * Razorpay signature / hash-shaped tokens (40+ hex chars). Catches Razorpay
 * payment ids, webhook signatures, opaque session tokens. Deliberately
 * conservative on the lower bound to avoid stripping legitimate UUIDs and
 * commit hashes, which we want to keep for debuggability.
 */
const HEX_TOKEN_RE = /\b[0-9a-f]{40,}\b/gi;

/**
 * `key=value` redaction for common token-bearing query params. Same shape as
 * EMAIL_QUERY_PARAM_RE — value is whatever sits between the `=` and the next
 * `&` or whitespace.
 */
const TOKEN_QUERY_PARAM_RE =
	/(\b(?:token|access_token|refresh_token|api_key|apikey|key|signature|sig|password|passwd|pwd|secret)=)[^&\s]+/gi;

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

function redactPii(s: string): string {
	return s
		.replace(EMAIL_RE, "[email]")
		.replace(EMAIL_URL_ENCODED_RE, "[email]")
		.replace(EMAIL_QUERY_PARAM_RE, "$1[redacted]")
		.replace(TOKEN_QUERY_PARAM_RE, "$1[redacted]")
		.replace(JWT_RE, "[jwt]")
		.replace(HEX_TOKEN_RE, "[token]");
}


function scrubHeaders(headers: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(headers)) {
		if (SENSITIVE_HEADER_KEYS.has(k.toLowerCase())) {
			out[k] = "[redacted]";
			continue;
		}
		out[k] = typeof v === "string" ? redactPii(v) : v;
	}
	return out;
}

/**
 * Object keys whose VALUE should be redacted wholesale regardless of type
 * (M-3). Matches as a substring (case-insensitive) so `razorpay_signature`,
 * `answer_key`, `user_email`, `access_token` etc. are all caught. Deliberately
 * does NOT include a bare `key` token (too broad — would hit `keyboard`,
 * `monkey`); `api_key`/`apikey` are covered explicitly.
 */
const SENSITIVE_OBJECT_KEY_RE =
	/(authorization|cookie|token|secret|password|passwd|pwd|signature|api[_-]?key|apikey|email|recipient|answer|prompt|\botp\b|totp)/i;

const MAX_REDACT_DEPTH = 6;

/**
 * Recursively redact PII from an arbitrary JSON-ish value (M-3). Strings get
 * the same regex treatment as everywhere else; object values under a sensitive
 * key are dropped entirely. Bounded by {@link MAX_REDACT_DEPTH} and a cycle
 * guard so a pathological/self-referential payload can't hang beforeSend.
 * Returns a redacted copy (does not mutate the input).
 */
function deepRedact(value: unknown, depth: number, seen: WeakSet<object>): unknown {
	if (typeof value === "string") return redactPii(value);
	if (value === null || typeof value !== "object") return value;
	if (depth >= MAX_REDACT_DEPTH) return "[redacted-depth]";
	if (seen.has(value as object)) return "[circular]";
	seen.add(value as object);
	if (Array.isArray(value)) {
		return value.map((item) => deepRedact(item, depth + 1, seen));
	}
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		out[k] = SENSITIVE_OBJECT_KEY_RE.test(k) ? "[redacted]" : deepRedact(v, depth + 1, seen);
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
		breadcrumbs?: Array<{ message?: string; data?: unknown }>;
		user?: { id?: string; email?: string; ip_address?: string; username?: string };
		message?: string;
		extra?: unknown;
		contexts?: unknown;
		tags?: unknown;
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
			if (typeof b.message === "string") b.message = redactPii(b.message);
			// M-3: console-integration breadcrumbs route structured args into
			// `breadcrumb.data` — previously unscrubbed, so a console.log of a
			// student answer / email / signature leaked verbatim.
			if (b.data && typeof b.data === "object") {
				b.data = deepRedact(b.data, 0, new WeakSet());
			}
		}
	}

	// M-3: `extra`, `contexts`, and `tags` were never walked. Any PII captured
	// via Sentry.setExtra / setContext / setTag (or `captureException(e, { extra })`)
	// previously reached Sentry storage unredacted.
	if (e.extra && typeof e.extra === "object") {
		e.extra = deepRedact(e.extra, 0, new WeakSet());
	}
	if (e.contexts && typeof e.contexts === "object") {
		e.contexts = deepRedact(e.contexts, 0, new WeakSet());
	}
	if (e.tags && typeof e.tags === "object") {
		e.tags = deepRedact(e.tags, 0, new WeakSet());
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
		e.message = redactPii(e.message);
	}

	return event;
}

/**
 * PII scrubber for Sentry **Logs** (the `enableLogs` stream fed by
 * `consoleLoggingIntegration`). The SDK applies `beforeSend` only to
 * error/transaction events — NOT to log records — so without a `beforeSendLog`
 * hook every `console.log`/`warn`/`error` reaches Sentry's Logs product with
 * the careful event-scrubbing bypassed. This mirrors {@link scrubSentryEvent}:
 * redact PII in the log message/body and deep-redact structured attributes
 * (where console args land). Mutates in place and returns the input; the SDK
 * contract also allows returning null to drop a log — we always keep, scrubbed.
 *
 * Loosely typed so the same helper accepts the SDK's `Log` shape across
 * runtimes/minor versions without importing SDK types into this multi-runtime file.
 */
export function scrubSentryLog<T>(log: T): T {
	const l = log as unknown as {
		message?: unknown;
		body?: unknown;
		attributes?: Record<string, unknown>;
	};
	if (typeof l.message === "string") l.message = redactPii(l.message);
	if (typeof l.body === "string") l.body = redactPii(l.body);
	if (l.attributes && typeof l.attributes === "object") {
		l.attributes = deepRedact(l.attributes, 0, new WeakSet()) as Record<string, unknown>;
	}
	return log;
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
