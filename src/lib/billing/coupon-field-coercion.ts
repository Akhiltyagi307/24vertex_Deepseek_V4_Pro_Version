/**
 * Supabase PostgREST usually returns Postgres booleans/integers as JSON booleans and
 * numbers; when values pass through proxies or casts, callers may see strings. These
 * helpers keep coupon redemption logic deterministic.
 */

export function coercePgBool(value: unknown): boolean | null {
	if (value === true || value === "true" || value === "t" || value === "yes" || value === 1 || value === "1") {
		return true;
	}
	if (value === false || value === "false" || value === "f" || value === "no" || value === 0 || value === "0") {
		return false;
	}
	return null;
}

export function coercePgPositiveInt(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		const t = Math.trunc(value);
		return t === value && t > 0 ? t : null;
	}
	if (typeof value === "string" && /^\d+$/.test(value.trim())) {
		const n = Number.parseInt(value, 10);
		return n > 0 ? n : null;
	}
	return null;
}

/** Non-negative integer (redemption counters, quotas from JSON). */
export function coercePgNonNegInt(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		const t = Math.trunc(value);
		return t >= 0 && t === value ? t : null;
	}
	if (typeof value === "string" && /^\d+$/.test(value.trim())) {
		return Number.parseInt(value, 10);
	}
	return null;
}
