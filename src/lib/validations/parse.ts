import type { z } from "zod";

/**
 * Discriminated result of validating an `unknown` against a zod schema.
 *
 * Mirrors the `{ ok } | { ok: false, error }` style already used by
 * {@link parseStrictEmptyQuery} in `@/lib/student/api-query-schemas`, so call
 * sites branch the same way everywhere. `issues` carries a short, developer-
 * facing summary of what failed (safe to attach to a Sentry `extra`); `error`
 * is the user-facing message.
 */
export type ParseResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string; issues: string[] };

/**
 * Validate `value` against `schema`, returning a discriminated result instead
 * of throwing. Use at trust boundaries (fetched JSON, raw SQL rows, anything
 * cast from `unknown`) so shape drift fails loudly and locally.
 */
export function safeParseOrError<T>(
	// `…, z.ZodTypeDef, unknown` (not the default `z.ZodType<T>`, whose input
	// defaults to `T`) so schemas with a `.transform()` — where the input shape
	// differs from the output `T` — are accepted and `T` binds to the OUTPUT.
	schema: z.ZodType<T, z.ZodTypeDef, unknown>,
	value: unknown,
	message = "Unexpected data shape.",
): ParseResult<T> {
	const parsed = schema.safeParse(value);
	if (parsed.success) {
		return { ok: true, data: parsed.data };
	}
	const issues = parsed.error.issues
		.slice(0, 5)
		.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
	return { ok: false, error: message, issues };
}
