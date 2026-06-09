/** Five-minute steps for wheel pickers (matches assignment due-date step). */
export const WHEEL_TIME_MINUTE_STEP = 5;

export const WHEEL_TIME_MINUTES = Array.from(
	{ length: 60 / WHEEL_TIME_MINUTE_STEP },
	(_, i) => i * WHEEL_TIME_MINUTE_STEP,
);

export const WHEEL_TIME_HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

export type WheelTimePeriod = "AM" | "PM";

export const WHEEL_TIME_PERIODS: readonly WheelTimePeriod[] = ["AM", "PM"];

export type WheelTimeParts = {
	hour24: number;
	minute: number;
};

export function snapMinuteToWheelStep(minute: number): number {
	return (
		WHEEL_TIME_MINUTES.find((m) => m === minute) ??
		WHEEL_TIME_MINUTES.reduce((best, m) => (Math.abs(m - minute) < Math.abs(best - minute) ? m : best))
	);
}

export function toWheelTime12Hour(hour24: number): { hour12: number; period: WheelTimePeriod } {
	const period: WheelTimePeriod = hour24 >= 12 ? "PM" : "AM";
	let hour12 = hour24 % 12;
	if (hour12 === 0) hour12 = 12;
	return { hour12, period };
}

export function toWheelTime24Hour(hour12: number, period: WheelTimePeriod): number {
	if (period === "AM") return hour12 === 12 ? 0 : hour12;
	return hour12 === 12 ? 12 : hour12 + 12;
}

export function wheelTimePartsFromDate(date: Date): WheelTimeParts {
	return {
		hour24: date.getHours(),
		minute: snapMinuteToWheelStep(date.getMinutes()),
	};
}

export function applyWheelTimePartsToDate(base: Date, parts: WheelTimeParts): Date {
	const next = new Date(base);
	next.setHours(parts.hour24, parts.minute, 0, 0);
	return next;
}
