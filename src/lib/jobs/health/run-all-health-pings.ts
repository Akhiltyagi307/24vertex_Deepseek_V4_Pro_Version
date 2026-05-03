import "server-only";

import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

import { db } from "@/db";
import { serviceHealthPings } from "@/db/schema/service-health-pings";

type PingStatus = "ok" | "degraded" | "fail";

async function record(provider: string, status: PingStatus, latencyMs: number | null, error?: string) {
	await db.insert(serviceHealthPings).values({
		provider,
		status,
		latencyMs: latencyMs ?? null,
		error: error ?? null,
	});
}

async function pingOpenAI(): Promise<void> {
	const key = process.env.OPENAI_API_KEY?.trim();
	if (!key) {
		await record("openai", "fail", null, "OPENAI_API_KEY missing");
		return;
	}
	const t0 = Date.now();
	try {
		const res = await fetch("https://api.openai.com/v1/models", {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(12_000),
		});
		const ms = Date.now() - t0;
		if (!res.ok) {
			await record("openai", res.status >= 500 ? "fail" : "degraded", ms, `http_${res.status}`);
			return;
		}
		await record("openai", "ok", ms);
	} catch (e) {
		await record("openai", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

async function pingAnthropic(): Promise<void> {
	const key = process.env.ANTHROPIC_API_KEY?.trim();
	if (!key) {
		await record("anthropic", "fail", null, "ANTHROPIC_API_KEY missing");
		return;
	}
	const t0 = Date.now();
	try {
		const res = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"x-api-key": key,
				"anthropic-version": "2023-06-01",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: "claude-3-5-haiku-20241022",
				max_tokens: 1,
				messages: [{ role: "user", content: "ping" }],
			}),
			signal: AbortSignal.timeout(15_000),
		});
		const ms = Date.now() - t0;
		if (!res.ok) {
			await record("anthropic", res.status >= 500 ? "fail" : "degraded", ms, `http_${res.status}`);
			return;
		}
		await record("anthropic", "ok", ms);
	} catch (e) {
		await record("anthropic", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

async function pingRazorpay(): Promise<void> {
	const id = process.env.RAZORPAY_KEY_ID?.trim();
	const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
	if (!id || !secret) {
		await record("razorpay", "fail", null, "RAZORPAY_KEY_ID/SECRET missing");
		return;
	}
	const auth = Buffer.from(`${id}:${secret}`).toString("base64");
	const t0 = Date.now();
	try {
		const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
			headers: { Authorization: `Basic ${auth}` },
			signal: AbortSignal.timeout(12_000),
		});
		const ms = Date.now() - t0;
		if (!res.ok) {
			await record("razorpay", res.status >= 500 ? "fail" : "degraded", ms, `http_${res.status}`);
			return;
		}
		await record("razorpay", "ok", ms);
	} catch (e) {
		await record("razorpay", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

async function pingResend(): Promise<void> {
	const key = process.env.RESEND_API_KEY?.trim();
	if (!key) {
		await record("resend", "fail", null, "RESEND_API_KEY missing");
		return;
	}
	const t0 = Date.now();
	try {
		const res = await fetch("https://api.resend.com/domains", {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(12_000),
		});
		const ms = Date.now() - t0;
		if (!res.ok) {
			await record("resend", res.status >= 500 ? "fail" : "degraded", ms, `http_${res.status}`);
			return;
		}
		await record("resend", "ok", ms);
	} catch (e) {
		await record("resend", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

async function pingSupabaseDb(): Promise<void> {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!url || !key) {
		await record("supabase_db", "fail", null, "Supabase URL or service role missing");
		return;
	}
	const t0 = Date.now();
	try {
		const supabase = createClient(url, key, { auth: { persistSession: false } });
		const { error } = await supabase.from("profiles").select("id").limit(1);
		const ms = Date.now() - t0;
		if (error) {
			await record("supabase_db", "fail", ms, error.message);
			return;
		}
		await record("supabase_db", "ok", ms);
	} catch (e) {
		await record("supabase_db", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

async function pingSupabaseAuth(): Promise<void> {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!url || !key) {
		await record("supabase_auth", "fail", null, "Supabase URL or service role missing");
		return;
	}
	const t0 = Date.now();
	try {
		const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
			headers: { apikey: key, Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(10_000),
		});
		const ms = Date.now() - t0;
		if (!res.ok) {
			await record("supabase_auth", res.status >= 500 ? "fail" : "degraded", ms, `http_${res.status}`);
			return;
		}
		await record("supabase_auth", "ok", ms);
	} catch (e) {
		await record("supabase_auth", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

async function pingUpstashRedis(): Promise<void> {
	const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
	const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
	if (!restUrl || !token) {
		await record("upstash_redis", "fail", null, "UPSTASH_REDIS_REST_* missing");
		return;
	}
	const t0 = Date.now();
	try {
		const redis = new Redis({ url: restUrl, token });
		await redis.ping();
		const ms = Date.now() - t0;
		await record("upstash_redis", "ok", ms);
	} catch (e) {
		await record("upstash_redis", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

async function pingVoyage(): Promise<void> {
	const key = process.env.VOYAGE_API_KEY?.trim();
	if (!key) {
		await record("voyage", "fail", null, "VOYAGE_API_KEY missing");
		return;
	}
	const t0 = Date.now();
	try {
		const res = await fetch("https://api.voyageai.com/v1/models", {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(12_000),
		});
		const ms = Date.now() - t0;
		if (!res.ok) {
			await record("voyage", res.status >= 500 ? "fail" : "degraded", ms, `http_${res.status}`);
			return;
		}
		await record("voyage", "ok", ms);
	} catch (e) {
		await record("voyage", "fail", Date.now() - t0, e instanceof Error ? e.message : String(e));
	}
}

/** Insert one row per provider into `service_health_pings`. */
export async function runAllHealthPings(): Promise<void> {
	await pingOpenAI();
	await pingAnthropic();
	await pingVoyage();
	await pingRazorpay();
	await pingResend();
	await pingSupabaseDb();
	await pingSupabaseAuth();
	await pingUpstashRedis();
}
