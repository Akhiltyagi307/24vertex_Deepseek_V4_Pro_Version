const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_RE = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;

export function scrubFeedbackText(text: string): string {
	return text
		.replace(EMAIL_RE, "[email]")
		.replace(JWT_RE, "[jwt]");
}

export function scrubFeedbackContext(context: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(context)) {
		if (value == null) continue;
		if (typeof value === "string") {
			out[key] = scrubFeedbackText(value);
		} else if (typeof value === "object" && !Array.isArray(value)) {
			out[key] = scrubFeedbackContext(value as Record<string, unknown>);
		} else {
			out[key] = value;
		}
	}
	return out;
}
