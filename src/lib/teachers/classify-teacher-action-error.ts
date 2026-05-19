import "server-only";

export type TeacherActionErrorBucket =
	| "not_signed_in"
	| "not_verified"
	| "suspended"
	| "not_teacher"
	| "validation_failed"
	| "rate_limited"
	| "supabase_rpc_error"
	| "supabase_query_error"
	| "unknown";

export type ClassifiedTeacherActionError = {
	bucket: TeacherActionErrorBucket;
	userMessage: string;
	sentryContext: Record<string, unknown>;
};

const USER_MESSAGE_BY_BUCKET: Record<TeacherActionErrorBucket, string> = {
	not_signed_in: "Sign in to continue.",
	not_teacher: "Sign in as a teacher to continue.",
	not_verified: "Your teacher account must be verified before using this feature.",
	suspended: "This teacher account is suspended.",
	validation_failed: "Check the form for errors and try again.",
	rate_limited: "Too many requests. Try again shortly.",
	supabase_rpc_error: "We couldn't complete that action. Try again.",
	supabase_query_error: "We couldn't load the latest data. Try again.",
	unknown: "Something went wrong. Try again.",
};

function isPostgrestLikeError(value: unknown): value is { code?: string; message?: string; details?: string; hint?: string } {
	return typeof value === "object" && value !== null && ("code" in value || "details" in value || "hint" in value);
}

function detectBucket(err: unknown): TeacherActionErrorBucket {
	if (err == null) return "unknown";
	if (typeof err === "object" && err !== null) {
		// Verified-teacher-session failure objects: { ok: false, code: ... }
		if ("code" in err && typeof (err as { code: unknown }).code === "string") {
			const code = String((err as { code: unknown }).code);
			if (code === "not_signed_in" || code === "not_teacher" || code === "not_verified" || code === "suspended") {
				return code;
			}
		}
		if (isPostgrestLikeError(err)) {
			const msg = String(err.message ?? "").toLowerCase();
			if (msg.includes("rate") && msg.includes("limit")) return "rate_limited";
			// Postgrest "PGRST"-prefixed codes are query plumbing; RPC errors usually carry SQLSTATE.
			const code = String(err.code ?? "");
			if (code.startsWith("PGRST")) return "supabase_query_error";
			if (/^[0-9A-Z]{5}$/.test(code)) return "supabase_rpc_error";
		}
		if (err instanceof Error) {
			const name = err.name ?? "";
			if (name === "ZodError") return "validation_failed";
		}
	}
	return "unknown";
}

/**
 * Map an arbitrary thrown value into a stable bucket + user-readable message +
 * Sentry context. Intended for the catch path of `withTeacherActionTelemetry`
 * and for any teacher action that wants typed error fan-in.
 */
export function classifyTeacherActionError(
	err: unknown,
	ctx: { action: string; userId?: string },
): ClassifiedTeacherActionError {
	const bucket = detectBucket(err);
	const sentryContext: Record<string, unknown> = {
		action: ctx.action,
		bucket,
	};
	if (ctx.userId) sentryContext.userId = ctx.userId;
	if (err instanceof Error) {
		sentryContext.errorName = err.name;
		sentryContext.errorMessage = err.message;
	} else if (isPostgrestLikeError(err)) {
		sentryContext.errorCode = err.code;
		sentryContext.errorMessage = err.message;
	}
	return {
		bucket,
		userMessage: USER_MESSAGE_BY_BUCKET[bucket],
		sentryContext,
	};
}
