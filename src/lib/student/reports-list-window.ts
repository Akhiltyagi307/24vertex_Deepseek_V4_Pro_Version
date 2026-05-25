import {
	addCalendarDaysToAppTimeZoneDateKey,
	appTimeZoneDateKey,
} from "@/lib/datetime/app-timezone";
import { dateKeyToIsoStartInAppTz } from "@/lib/student/dashboard-performance-stats";

/** Default reports list window (calendar months, IST). */
export const REPORTS_LIST_WINDOW_MONTHS = 18;

export const REPORTS_LIST_PAGE_SIZE = 200;

export function reportsListWindowStartIso(now: Date = new Date()): string {
	const endKey = appTimeZoneDateKey(now);
	const startKey = addCalendarDaysToAppTimeZoneDateKey(endKey, -(REPORTS_LIST_WINDOW_MONTHS * 31));
	return dateKeyToIsoStartInAppTz(startKey);
}
