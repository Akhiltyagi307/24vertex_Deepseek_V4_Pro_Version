function readTrimmedEnv(name: string): string {
	return process.env[name]?.trim() ?? "";
}

function parseHttpUrl(raw: string, envName: string): string {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		throw new Error(`Invalid ${envName}: expected an absolute URL.`);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`Invalid ${envName}: expected http:// or https://.`);
	}
	const href = parsed.toString();
	return href.endsWith("/") ? href.slice(0, -1) : href;
}

function isLoopbackHost(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isProductionDeployment(): boolean {
	return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function getSupabaseUrl(): string {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
	return url;
}

/** Private bucket for GDPR/DSR ZIP exports (create in Supabase Dashboard; default name). */
export function getComplianceExportsBucket(): string {
	return readTrimmedEnv("COMPLIANCE_EXPORTS_BUCKET") || "compliance-exports";
}

/** Publishable (recommended) or legacy anon JWT */
export function getSupabasePublishableKey(): string {
	const key =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!key) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
	}
	return key;
}

export function getAppUrl(): string {
	const configured = readTrimmedEnv("NEXT_PUBLIC_APP_URL");
	if (!configured) {
		if (isProductionDeployment()) {
			throw new Error("Missing NEXT_PUBLIC_APP_URL");
		}
		return "http://localhost:3001";
	}
	const appUrl = parseHttpUrl(configured, "NEXT_PUBLIC_APP_URL");
	if (isProductionDeployment() && isLoopbackHost(new URL(appUrl).hostname)) {
		throw new Error("NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
	}
	return appUrl;
}

/**
 * Optional support inbox shown on legal pages. If unset, copy falls back to in-app / school routing.
 * Must be safe to expose to the browser (NEXT_PUBLIC_).
 */
export function getPublicSupportEmail(): string | null {
	const raw = readTrimmedEnv("NEXT_PUBLIC_SUPPORT_EMAIL");
	if (!raw || !raw.includes("@")) return null;
	return raw;
}

/** Resend API key — required when sending parent contact notifications. */
export function getResendApiKey(): string {
	const key = process.env.RESEND_API_KEY?.trim();
	if (!key) throw new Error("Missing RESEND_API_KEY");
	return key;
}

/**
 * Verified sender for Resend, e.g. `EduAI <notifications@yourdomain.com>` or `notifications@yourdomain.com`.
 * Prefer `RESEND_FROM_EMAIL`; `RESEND_FROM` is supported for backward compatibility.
 */
export function getResendFrom(): string {
	const from =
		process.env.RESEND_FROM_EMAIL?.trim() || process.env.RESEND_FROM?.trim();
	if (!from) {
		throw new Error("Missing RESEND_FROM_EMAIL or RESEND_FROM");
	}
	return from;
}

/**
 * Server-only secret used to sign one-click unsubscribe tokens that go in the
 * `List-Unsubscribe` email header. Returns `null` when the env var is unset —
 * the email pipeline gracefully skips the header instead of throwing, so a
 * missing secret degrades to "no one-click" rather than blocking sends.
 */
export function getEmailUnsubscribeSecret(): string | null {
	const raw = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim();
	return raw && raw.length >= 32 ? raw : null;
}

/**
 * Recipients for admin-side notification mail (panic, weekly digest). Reads
 * `ADMIN_NOTIFICATION_EMAILS` first as a comma-separated distribution list,
 * then falls back to `ADMIN_EMAIL` for single-admin deployments. Whitespace
 * around each entry is trimmed and empties are dropped. Returns `[]` when
 * nothing is configured — callers should treat that as "no admin to email".
 *
 * Note: admin-login auth still gates on the single `ADMIN_EMAIL` variable
 * (see `src/lib/admin/auth.ts`); this helper is only for outbound
 * notifications and intentionally does not change auth behaviour.
 */
export function getAdminNotificationRecipients(): string[] {
	const list = process.env.ADMIN_NOTIFICATION_EMAILS?.trim();
	if (list) {
		return list
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0 && s.includes("@"));
	}
	const single = process.env.ADMIN_EMAIL?.trim();
	if (single && single.includes("@")) return [single];
	return [];
}

/** OpenAI API key — server-only; used by `@ai-sdk/openai` with the Vercel AI SDK. */
export function getOpenAIApiKey(): string {
	const key = process.env.OPENAI_API_KEY?.trim();
	if (!key) throw new Error("Missing OPENAI_API_KEY");
	return key;
}

/** Chat model id for `@ai-sdk/openai`. Override with `OPENAI_CHAT_MODEL`. */
export function getOpenAIChatModel(): string {
	const model = readTrimmedEnv("OPENAI_CHAT_MODEL");
	if (model) return model;
	if (isProductionDeployment()) {
		throw new Error("Missing OPENAI_CHAT_MODEL");
	}
	return "gpt-5.4-mini";
}

// ============================================================
// Billing / SaaS
// ============================================================

/** Razorpay server-side key id. */
export function getRazorpayKeyId(): string {
	const key = readTrimmedEnv("RAZORPAY_KEY_ID");
	if (!key) throw new Error("Missing RAZORPAY_KEY_ID");
	return key;
}

/** Razorpay server-side key secret (never expose to the browser). */
export function getRazorpayKeySecret(): string {
	const key = readTrimmedEnv("RAZORPAY_KEY_SECRET");
	if (!key) throw new Error("Missing RAZORPAY_KEY_SECRET");
	return key;
}

/** Shared webhook secret configured in Razorpay Dashboard → Webhooks. */
export function getRazorpayWebhookSecret(): string {
	const key = readTrimmedEnv("RAZORPAY_WEBHOOK_SECRET");
	if (!key) throw new Error("Missing RAZORPAY_WEBHOOK_SECRET");
	return key;
}

/** Public key id embedded in Razorpay Checkout on the client. */
export function getPublicRazorpayKeyId(): string {
	const key =
		readTrimmedEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID") || readTrimmedEnv("RAZORPAY_KEY_ID");
	if (!key) throw new Error("Missing NEXT_PUBLIC_RAZORPAY_KEY_ID (or RAZORPAY_KEY_ID for server-only setups)");
	return key;
}

/**
 * Gate for SaaS quota enforcement. Set `SAAS_ENFORCEMENT=true` in production; keep
 * it off in dev so existing seed students do not get locked out mid-session.
 */
export function isSaasEnforcementEnabled(): boolean {
	return readTrimmedEnv("SAAS_ENFORCEMENT").toLowerCase() === "true";
}
