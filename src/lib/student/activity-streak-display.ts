import {
	APP_TIME_ZONE,
	addCalendarDaysToAppTimeZoneDateKey,
	appTimeZoneDateKey,
	dateKeyToNoonInAppTimeZone,
} from "@/lib/datetime/app-timezone";

export const ACTIVITY_STREAK_REFRESH_EVENT = "eduai:activity-streak-refresh";

/** Notify top-bar streak widget to refetch (e.g. after practice submit). */
export function notifyActivityStreakRefresh(): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(ACTIVITY_STREAK_REFRESH_EVENT));
}

const weekdayShortToIso: Record<string, number> = {
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
	Sun: 7,
};

function dayOfWeekIsoInAppTimeZone(dateKey: string): number {
	const d = dateKeyToNoonInAppTimeZone(dateKey);
	const short = new Intl.DateTimeFormat("en-US", {
		timeZone: APP_TIME_ZONE,
		weekday: "short",
	}).format(d);
	return weekdayShortToIso[short] ?? 1;
}

function mondayOfWeekContaining(dateKey: string): string {
	const isoDow = dayOfWeekIsoInAppTimeZone(dateKey);
	return addCalendarDaysToAppTimeZoneDateKey(dateKey, -(isoDow - 1));
}

function sundayOfWeekContaining(dateKey: string): string {
	return addCalendarDaysToAppTimeZoneDateKey(mondayOfWeekContaining(dateKey), 6);
}

/** e.g. "12 May" for a yyyy-MM-dd week anchor. */
export function formatStreakWeekOfLabel(dateKey: string | null): string | null {
	if (!dateKey) return null;
	const d = dateKeyToNoonInAppTimeZone(dateKey);
	if (!Number.isFinite(d.getTime())) return null;
	return new Intl.DateTimeFormat("en-IN", {
		timeZone: APP_TIME_ZONE,
		day: "numeric",
		month: "short",
	}).format(d);
}

/** Deadline copy for the current calendar week (India time). */
export function formatStreakWeekDeadline(now = new Date()): string {
	const todayKey = appTimeZoneDateKey(now);
	const sundayKey = sundayOfWeekContaining(todayKey);
	const label = formatStreakWeekOfLabel(sundayKey);
	return label ? `Submit by end of ${label} (India time)` : "Submit before this week ends (India time)";
}

export function formatLastActiveWeekLabel(dateKey: string | null): string | null {
	const label = formatStreakWeekOfLabel(dateKey);
	return label ? `Last active: week of ${label}` : null;
}

export function formatLongestStreakLabel(longestWeeks: number): string | null {
	if (longestWeeks <= 0) return null;
	return longestWeeks === 1 ? "Longest streak: 1 week" : `Longest streak: ${longestWeeks} weeks`;
}
