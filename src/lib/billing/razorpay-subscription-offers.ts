import "server-only";

import { getRazorpayKeyId, getRazorpayKeySecret } from "@/lib/env";

import { fetchRazorpayPlan } from "./razorpay";

type RazorpayErrorBody = { error?: { description?: string; code?: string } };

async function razorpayPostJson<T>(path: string, body: unknown): Promise<T> {
	const keyId = getRazorpayKeyId();
	const keySecret = getRazorpayKeySecret();
	const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
	const res = await fetch(`https://api.razorpay.com/v1${path}`, {
		method: "POST",
		headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const json = (await res.json().catch(() => ({}))) as T & RazorpayErrorBody;
	if (!res.ok) {
		const desc = json.error?.description ?? res.statusText;
		throw new Error(`Razorpay ${path}: ${desc}`);
	}
	return json;
}

/**
 * Creates a Razorpay **subscription** offer for a plan so `offer_id` can be passed to
 * `subscriptions.create`. Razorpay’s offer schema varies by account/product; this uses a
 * common shape (plan_id + period + discounted first-cycle item amount). If Razorpay
 * rejects the payload, surface the error and create offers from the Dashboard instead,
 * then paste IDs into `razorpay_offers_by_plan`.
 */
export async function createSubscriptionPercentOffer(input: {
	name: string;
	razorpayPlanId: string;
	percentOff: number;
	/** From `public.plans.interval` — `month` or `year`. */
	planInterval: string;
}): Promise<{ id: string }> {
	const plan = await fetchRazorpayPlan(input.razorpayPlanId);
	const itemAmount = plan.item?.amount ?? 0;
	if (!itemAmount || itemAmount <= 0) {
		throw new Error("Could not read a positive plan amount from Razorpay for this plan_id.");
	}
	const discounted = Math.max(1, Math.round((itemAmount * (100 - input.percentOff)) / 100));
	const razorpayPeriod = input.planInterval === "year" ? "yearly" : "monthly";
	const body = {
		name: input.name,
		plan_id: input.razorpayPlanId,
		period: razorpayPeriod,
		interval: 1,
		item: {
			name: `${input.percentOff}% off (first cycle)`,
			amount: discounted,
			currency: plan.item?.currency ?? "INR",
			description: "EduAI checkout coupon",
		},
	};
	return razorpayPostJson<{ id: string }>("/offers", body);
}
