import { appTimeZoneDateKey, dateKeyToNoonInAppTimeZone } from "@/lib/datetime/app-timezone";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** yyyy-MM-dd for “today” in the product calendar ({@link APP_TIME_ZONE}). */
export function assignmentDueMinDateKey(now = new Date()): string {
	return appTimeZoneDateKey(now);
}

/** Disable calendar days strictly before today in the product time zone. */
export function assignmentDueCalendarDisabledMatchers(now = new Date()) {
	const min = dateKeyToNoonInAppTimeZone(assignmentDueMinDateKey(now));
	return Number.isFinite(min.getTime()) ? [{ before: min }] : undefined;
}

/** True when the due instant is strictly before `now`. */
export function isAssignmentDueAtInPast(dueAt: string | Date, now = new Date()): boolean {
	const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
	if (!Number.isFinite(d.getTime())) return true;
	return d.getTime() < now.getTime();
}

/** Bump `selected` forward to the next allowed instant (now, rounded up to 5 minutes). */
export function clampAssignmentDueAtToFuture(selected: Date, now = new Date()): Date {
	if (selected.getTime() >= now.getTime()) return selected;
	const bumped = new Date(Math.ceil(now.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS);
	return bumped;
}

/**
 * Default time when a calendar day is picked without a prior selection.
 * Uses noon unless that is already in the past, then the next 5-minute slot from now.
 */
export function defaultTimeOnAssignmentDueDay(day: Date, now = new Date()): Date {
	const next = new Date(day);
	const noon = new Date(next);
	noon.setHours(12, 0, 0, 0);
	if (noon.getTime() >= now.getTime()) return noon;
	return clampAssignmentDueAtToFuture(next, now);
}
