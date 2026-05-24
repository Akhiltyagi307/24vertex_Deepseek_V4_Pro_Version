/**
 * Indian phone-number parsing for the public contact form.
 *
 * No server-only deps so this module is safe to import from both the API
 * route (`app/api/contact/route.ts`) and the client form
 * (`src/components/marketing/contact/contact-form.tsx`). Keeping a single
 * source of truth here prevents the client and server from drifting on
 * what counts as "valid".
 *
 * Accepted shapes (whitespace, hyphens, parentheses, and dots are stripped
 * before parsing):
 *   - 9876543210              (bare 10-digit mobile)
 *   - 09876543210             (national format, leading 0)
 *   - +919876543210           (E.164)
 *   - 919876543210            (country code without +)
 *   - 00919876543210          (international dialled from some locales)
 *   - +91 98765 43210         (any whitespace/hyphens/parens inside)
 *
 * Validation rule:
 *   - After normalising, the 10-digit subscriber number MUST start with
 *     6, 7, 8, or 9. These are the only Indian mobile series. Landlines
 *     (010 / 011 / 022 / etc.) and short codes are rejected because the
 *     contact form expects a mobile we can reach back on.
 */

export type ParsedIndianPhone = {
	/** Canonical E.164 form, e.g. `+919876543210`. Safe to display + store. */
	canonical: string;
	/** Pretty form for humans, e.g. `+91 98765 43210`. */
	pretty: string;
};

/** Indian mobile series. Landlines and short codes are out of scope. */
const INDIAN_MOBILE_PREFIX = /^[6-9]/;

/** Parse + validate an Indian mobile number. Returns null when invalid. */
export function parseIndianPhone(raw: string): ParsedIndianPhone | null {
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// Strip everything that isn't a digit or the leading +.
	// We only care about + for country-code detection.
	const compact = trimmed.replace(/[\s\-().]/g, "");
	if (!/^[+0-9]+$/.test(compact)) return null;

	// Pull off the country code in priority order: +91, 0091, 91, leading 0.
	let digits = compact;
	if (digits.startsWith("+91")) {
		digits = digits.slice(3);
	} else if (digits.startsWith("0091")) {
		digits = digits.slice(4);
	} else if (digits.startsWith("91") && digits.length === 12) {
		digits = digits.slice(2);
	} else if (digits.startsWith("0") && digits.length === 11) {
		digits = digits.slice(1);
	} else if (digits.startsWith("+")) {
		// `+` with a non-91 country code — not Indian.
		return null;
	}

	if (digits.length !== 10) return null;
	if (!/^\d{10}$/.test(digits)) return null;
	if (!INDIAN_MOBILE_PREFIX.test(digits)) return null;

	const canonical = `+91${digits}`;
	const pretty = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
	return { canonical, pretty };
}

export function isValidIndianPhone(raw: string): boolean {
	return parseIndianPhone(raw) !== null;
}
