#!/usr/bin/env node
// @ts-check

/**
 * One-shot helper that creates Razorpay plans (monthly / yearly) for our pro
 * tiers and prints the resulting plan IDs so you can paste them into the
 * `plans.razorpay_plan_id` column (via the Supabase dashboard, an admin RPC,
 * or a follow-up SQL migration).
 *
 * You only need to run this once per environment (test keys, live keys).
 *
 * Usage:
 *   pnpm exec node scripts/seed-razorpay-plans.mjs
 *
 * Env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (from .env.local)
 *
 * If you prefer, the Razorpay MCP exposes the same create-plan tool — the
 * parameters mirror what we send below.
 */

import "dotenv/config";
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

if (!keyId || !keySecret) {
	console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in env.");
	process.exit(1);
}

const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

/** @type {Array<{code: string, body: Record<string, unknown>}>} */
const plans = [
	{
		code: "pro_monthly",
		body: {
			period: "monthly",
			interval: 1,
			item: {
				name: "24Vertex Pro Monthly",
				amount: 60000, // paise (₹600)
				currency: "INR",
				description: "30 practice tests/month + generous AI doubt-chat tokens",
			},
			notes: { plan_code: "pro_monthly", product: "vertex24" },
		},
	},
	{
		code: "pro_annual",
		body: {
			period: "yearly",
			interval: 1,
			item: {
				name: "24Vertex Pro Annual",
				amount: 600000, // paise (₹6,000)
				currency: "INR",
				description: "12-month pool — 360 practice tests + expanded AI doubt-chat",
			},
			notes: { plan_code: "pro_annual", product: "vertex24" },
		},
	},
];

for (const { code, body } of plans) {
	try {
		const created = await rzp.plans.create(body);
		console.log(`✓ ${code} → ${created.id}`);
		console.log(
			`  update SQL: UPDATE public.plans SET razorpay_plan_id = '${created.id}' WHERE code = '${code}';`,
		);
	} catch (err) {
		console.error(`✗ ${code} failed:`, err?.error?.description ?? err?.message ?? err);
	}
}
