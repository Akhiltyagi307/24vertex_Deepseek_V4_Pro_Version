type LogMetadataValue = string | number | boolean | null | undefined;

type LogMetadata = Record<string, LogMetadataValue>;

type SupabaseErrorLike = {
	message?: string;
	code?: string;
	/** PostgREST may return null for absent fields */
	details?: string | null;
	hint?: string | null;
};

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

export function logServerError(context: string, error: unknown, metadata?: LogMetadata): void {
	if (error instanceof Error) {
		const headline = formatErrorHeadline(context, error.message, error.name, metadata);
		if (process.env.NODE_ENV === "development") {
			console.error(headline, { stack: error.stack ?? "" });
			return;
		}
		console.error(headline);
		return;
	}

	const fallbackMessage = typeof error === "string" ? error : "Unknown error";
	console.error(formatErrorHeadline(context, fallbackMessage, undefined, metadata));
}
