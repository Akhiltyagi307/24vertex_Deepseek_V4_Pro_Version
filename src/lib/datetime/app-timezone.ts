/**
 * Single product time zone for calendar bucketing and user-visible clocks (India).
 * Server runtimes default to UTC; never rely on `Date#getDate()` etc. without pinning this zone.
 */
export const APP_TIME_ZONE = "Asia/Kolkata" as const;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: APP_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** yyyy-MM-dd for the instant `d` in {@link APP_TIME_ZONE}. */
export function appTimeZoneDateKey(d: Date): string {
	return dateKeyFormatter.format(d);
}

/** Shift a yyyy-MM-dd key by whole calendar days in India (no DST). */
export function addCalendarDaysToAppTimeZoneDateKey(dateKey: string, deltaDays: number): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	if (!y || !m || !d) return dateKey;
	const inst = new Date(
		`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+05:30`,
	);
	inst.setTime(inst.getTime() + deltaDays * 86_400_000);
	return appTimeZoneDateKey(inst);
}

/**
 * Stable date+time for SSR/hydration: avoid `dateStyle`/`timeStyle` composition, which can differ
 * between Node and browser ICU (e.g. comma vs "at", AM/PM casing).
 */
export function formatDateTimeMediumShortInAppTimeZone(iso: string | Date): string {
	const d = typeof iso === "string" ? new Date(iso) : iso;
	if (!Number.isFinite(d.getTime())) return "—";
	const fmt = new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
	const parts = fmt.formatToParts(d);
	const val = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
	const day = val("day");
	const month = val("month");
	const year = val("year");
	const hour = val("hour");
	const minute = val("minute");
	const dayPeriod = val("dayPeriod");
	if (!day || !month || !year || !hour || !minute) return fmt.format(d);
	const ap = dayPeriod ? ` ${dayPeriod.toLowerCase()}` : "";
	return `${day} ${month} ${year}, ${hour}:${minute}${ap}`;
}

/** Time only (short) in {@link APP_TIME_ZONE}. */
export function formatTimeShortInAppTimeZone(iso: string | Date | number): string {
	const d =
		typeof iso === "number"
			? new Date(iso)
			: typeof iso === "string"
				? new Date(iso)
				: iso;
	if (!Number.isFinite(d.getTime())) return "";
	const fmt = new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
	const parts = fmt.formatToParts(d);
	const hour = parts.find((p) => p.type === "hour")?.value;
	const minute = parts.find((p) => p.type === "minute")?.value;
	const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value;
	if (!hour || !minute) return fmt.format(d);
	const ap = dayPeriod ? ` ${dayPeriod.toLowerCase()}` : "";
	return `${hour}:${minute}${ap}`;
}

function asValidDate(iso: string | Date): Date | null {
	const d = typeof iso === "string" ? new Date(iso) : iso;
	return Number.isFinite(d.getTime()) ? d : null;
}

/** Calendar date only, medium (e.g. 18 Apr 2026). */
export function formatDateMediumInAppTimeZone(iso: string | Date): string {
	const d = asValidDate(iso);
	if (!d) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		dateStyle: "medium",
	}).format(d);
}

/** Calendar date, long style (e.g. 18 April 2026). */
export function formatDateLongStyleInAppTimeZone(iso: string | Date): string {
	const d = asValidDate(iso);
	if (!d) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		dateStyle: "long",
	}).format(d);
}

/** e.g. 18 April 2026 */
export function formatDateLongDMYInAppTimeZone(iso: string | Date): string {
	const d = asValidDate(iso);
	if (!d) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(d);
}

/** e.g. 18 Apr 2026 */
export function formatDateShortDMYInAppTimeZone(iso: string | Date): string {
	const d = asValidDate(iso);
	if (!d) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(d);
}

/** e.g. 18 Apr (no year) */
export function formatDateMonthShortDayInAppTimeZone(iso: string | Date): string {
	const d = asValidDate(iso);
	if (!d) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		month: "short",
		day: "numeric",
	}).format(d);
}

/**
 * Parse yyyy-MM-dd as noon in {@link APP_TIME_ZONE}.
 * Safe for anchoring “this calendar day” without relying on the host timezone.
 */
export function dateKeyToNoonInAppTimeZone(dateKey: string): Date {
	const [ys, ms, ds] = dateKey.split("-");
	const y = Number(ys);
	const m = Number(ms);
	const d = Number(ds);
	if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
		return new Date();
	}
	return new Date(
		`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+05:30`,
	);
}

/** e.g. Sunday, 18 April 2026 — for a yyyy-MM-dd key in {@link APP_TIME_ZONE}. */
export function formatDateKeyWeekdayLongInAppTimeZone(dateKey: string): string {
	const d = dateKeyToNoonInAppTimeZone(dateKey);
	if (!Number.isFinite(d.getTime())) return dateKey;
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(d);
}
