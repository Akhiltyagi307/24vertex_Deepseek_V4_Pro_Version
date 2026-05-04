/**
 * Extends a billing anchor date by one catalog interval (plans.interval / Razorpay-style strings).
 * Used by admin `force-renew` when pushing `current_period_end` without Razorpay.
 */
export function addPlanBillingInterval(anchor: Date, planInterval: string): Date {
	const d = new Date(anchor.getTime());
	const i = planInterval.toLowerCase();
	if (i.includes("year")) {
		d.setFullYear(d.getFullYear() + 1);
		return d;
	}
	if (i.includes("month")) {
		d.setMonth(d.getMonth() + 1);
		return d;
	}
	if (i.includes("week")) {
		d.setDate(d.getDate() + 7);
		return d;
	}
	if (i.includes("day")) {
		d.setDate(d.getDate() + 1);
		return d;
	}
	d.setDate(d.getDate() + 30);
	return d;
}
