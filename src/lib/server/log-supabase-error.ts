type LogMetadataValue = string | number | boolean | null | undefined;

type LogMetadata = Record<string, LogMetadataValue>;

type SupabaseErrorLike = {
	message?: string;
	code?: string;
	/** PostgREST may return null for absent fields */
	details?: string | null;
	hint?: string | null;
};

/** Postgres `undefined_column` — e.g. app deployed before a migration was applied. */
export function isPostgresUndefinedColumnError(error: SupabaseErrorLike | null | undefined): boolean {
	return error?.code === "42703";
}

function formatLogMetadata(metadata?: LogMetadata): string {
	if (!metadata) return "";
	return Object.entries(metadata)
		.filter(([, value]) => value != null && value !== "")
		.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
		.join(" ");
}

function formatErrorHeadline(context: string, message?: string, code?: string, metadata?: LogMetadata): string {
	const parts = [`[${context}]`];
	const meta = formatLogMetadata(metadata);
	if (meta) parts.push(meta);
	if (code) parts.push(`code=${JSON.stringify(code)}`);
	if (message) parts.push(`message=${JSON.stringify(message)}`);
	return parts.join(" ");
}

/**
 * Logs PostgREST / Supabase client errors using a single production-safe format.
 * Never pass `error.message` to the browser — use a fixed user-facing string instead.
 */
export function logSupabaseError(
	context: string,
	error: SupabaseErrorLike,
	metadata?: LogMetadata,
): void {
	const headline = formatErrorHeadline(context, error.message, error.code, metadata);
	if (process.env.NODE_ENV === "development") {
		console.error(headline, {
			details: error.details ?? "",
			hint: error.hint ?? "",
		});
		return;
	}
	console.error(headline);
}

/** Pluck AI SDK APICallError fields (`responseBody`, `statusCode`, `url`)
 * when present, plus the underlying `cause` for any wrapped Error. The
 * Vercel AI SDK puts the raw failing HTTP body in `responseBody` and the
 * inner JSON-parse / zod error in `cause` — without surfacing those the
 * top-line `Failed to process successful response` message is useless for
 * diagnosis. Truncate responseBody so we never blow up logs on a 100k
 * token reply.
 */
function extractCauseDetails(error: Error): Record<string, unknown> | null {
	const e = error as unknown as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	if (e.cause instanceof Error) {
		out.cause_name = e.cause.name;
		out.cause_message = e.cause.message;
	} else if (e.cause != null) {
		out.cause = e.cause;
	}
	if (typeof e.statusCode === "number") out.status = e.statusCode;
	if (typeof e.url === "string") out.url = e.url;
	if (typeof e.responseBody === "string" && e.responseBody.length > 0) {
		const body = e.responseBody;
		out.response_body =
			body.length > 4000 ? `${body.slice(0, 4000)}…(+${body.length - 4000} bytes)` : body;
	}
	return Object.keys(out).length === 0 ? null : out;
}

export function logServerError(context: string, error: unknown, metadata?: LogMetadata): void {
	if (error instanceof Error) {
		const headline = formatErrorHeadline(context, error.message, error.name, metadata);
		if (process.env.NODE_ENV === "development") {
			const detail: Record<string, unknown> = { stack: error.stack ?? "" };
			const cause = extractCauseDetails(error);
			if (cause) Object.assign(detail, cause);
			console.error(headline, detail);
			return;
		}
		console.error(headline);
		return;
	}

	const fallbackMessage = typeof error === "string" ? error : "Unknown error";
	console.error(formatErrorHeadline(context, fallbackMessage, undefined, metadata));
}
