const NULL_ESCAPE_RE = /\\u0000/gi;
const NULL_CHAR_RE = /\u0000/g;

export function sanitizeForPostgresJsonb<T>(value: T): T {
	if (typeof value === "string") {
		return value.replace(NULL_CHAR_RE, "").replace(NULL_ESCAPE_RE, "") as T;
	}
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeForPostgresJsonb(item)) as T;
	}
	if (value != null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, nested]) => [key, sanitizeForPostgresJsonb(nested)]),
		) as T;
	}
	return value;
}
