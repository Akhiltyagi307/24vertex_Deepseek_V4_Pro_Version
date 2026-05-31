#!/usr/bin/env node
// @ts-check

/**
 * Creates Razorpay plans (₹600 / ₹6,000) and writes `plans.razorpay_plan_id` to one or two Postgres DBs.
 *
 * Usage:
 *   # Prefer Vercel-injected secrets (rename .env.local first if it has placeholder Razorpay keys):
 *   npx vercel env run --environment preview -- node scripts/seed-razorpay-plans-and-sync-db.mjs
 *
 *   # Or pass an env file with real keys + DATABASE_URL:
 *   node --env-file=.env.razorpay.live scripts/seed-razorpay-plans-and-sync-db.mjs
 *
 * Optional second project (prod Supabase `suwakggcbxmmvqzeudmq`):
 *   DATABASE_URL_PROD=postgresql://... node --env-file=... scripts/seed-razorpay-plans-and-sync-db.mjs
 */

import "dotenv/config";
import postgres from "postgres";
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

if (!keyId || !keySecret) {
	console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.");
	process.exit(1);
}

if (/XXX|YOUR_KEY|REPLACE/i.test(keyId) || /YOUR_KEY|REPLACE/i.test(keySecret)) {
	console.error(
		"Razorpay env vars look like placeholders. Generate keys in Razorpay Dashboard → API Keys, then set them on Vercel (or your env file).",
	);
	process.exit(1);
}

/** @type {Array<{code: string, body: Record<string, unknown>}>} */
const planBodies = [
	{
		code: "pro_monthly",
		body: {
			period: "monthly",
			interval: 1,
			item: {
				name: "24Vertex Pro Monthly",
				amount: 60000,
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
				amount: 600000,
				currency: "INR",
				description: "12-month pool — 360 practice tests + expanded AI doubt-chat",
			},
			notes: { plan_code: "pro_annual", product: "vertex24" },
		},
	},
];

const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

/** @type {Record<string, string>} */
const created = {};

for (const { code, body } of planBodies) {
	try {
		const plan = await rzp.plans.create(body);
		created[code] = plan.id;
		console.log(`✓ Razorpay ${code} → ${plan.id}`);
	} catch (err) {
		const msg = err?.error?.description ?? err?.message ?? String(err);
		console.error(`✗ Razorpay ${code} failed:`, msg);
		process.exit(1);
	}
}

/** @param {string} databaseUrl */
async function syncDatabase(databaseUrl, label) {
	const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
	try {
		for (const [code, planId] of Object.entries(created)) {
			const rows = await sql`
				UPDATE public.plans
				SET razorpay_plan_id = ${planId}, updated_at = NOW()
				WHERE code = ${code}
				RETURNING code, price_paise, razorpay_plan_id
			`;
			if (rows.length === 0) {
				throw new Error(`plan ${code} not found`);
			}
			console.log(`  ✓ ${label} ${code} → ${planId} (price_paise=${rows[0].price_paise})`);
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
}

const primaryUrl = process.env.DATABASE_URL?.trim();
const prodUrl = process.env.DATABASE_URL_PROD?.trim();

if (!primaryUrl && !prodUrl) {
	console.log("\nNo DATABASE_URL set — Razorpay plans created. Apply manually:\n");
	for (const [code, planId] of Object.entries(created)) {
		console.log(`UPDATE public.plans SET razorpay_plan_id = '${planId}' WHERE code = '${code}';`);
	}
	process.exit(0);
}

if (primaryUrl) {
	console.log("\nSyncing primary database…");
	await syncDatabase(primaryUrl, "primary");
}
if (prodUrl) {
	console.log("\nSyncing prod database (DATABASE_URL_PROD)…");
	await syncDatabase(prodUrl, "prod");
}

console.log("\nDone.");
