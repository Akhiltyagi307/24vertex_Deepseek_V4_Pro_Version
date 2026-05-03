import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const globalForPg = globalThis as unknown as {
	__eduAiPostgres?: ReturnType<typeof postgres>;
	__eduAiRateLimitPostgres?: ReturnType<typeof postgres>;
};

function parsePoolMax(envVar: string, fallback: number, ceiling = 10): number {
	const raw = process.env[envVar];
	if (raw === undefined || raw === "") return fallback;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 1) return fallback;
	return Math.min(n, ceiling);
}

function warnIfDirectSupabaseHost(url: string) {
	if (process.env.NODE_ENV === "production") return;
	try {
		const u = new URL(url);
		if (u.hostname.startsWith("db.") && u.hostname.endsWith(".supabase.co") && u.port === "5432") {
			console.warn(
				"[db] DATABASE_URL uses Supabase direct DB (:5432). Prefer the transaction pooler (:6543, …pooler.supabase.com, add pgbouncer=true) or you may exhaust project connection limits.",
			);
		}
	} catch {
		/* ignore invalid URL */
	}
}

function createPostgres(url: string) {
	const isProd = process.env.NODE_ENV === "production";
	warnIfDirectSupabaseHost(url);
	return postgres(url, {
		prepare: false,
		max: parsePoolMax("DATABASE_POOL_MAX", 5),
		idle_timeout: isProd ? 60 : 20,
		max_lifetime: isProd ? 60 * 60 : 60 * 5,
		connect_timeout: 15,
		connection: {
			application_name: "edu-ai-next",
		},
	});
}

/**
 * Dedicated, small pool for rate-limit RPCs. Isolated from the app pool so a slow
 * application query cannot starve the rate limiter, and a misbehaving rate-limit
 * call cannot starve the application. `statement_timeout` makes a stuck call fail
 * fast so the consumer can fall back to fail-open via the circuit breaker.
 *
 * Falls back to DATABASE_URL when DATABASE_RATELIMIT_URL is unset (local dev).
 */
function createRateLimitPostgres(url: string) {
	const isProd = process.env.NODE_ENV === "production";
	return postgres(url, {
		prepare: false,
		max: parsePoolMax("DATABASE_RATELIMIT_POOL_MAX", 3, 6),
		idle_timeout: 30,
		max_lifetime: isProd ? 30 * 60 : 60 * 5,
		connect_timeout: 5,
		connection: {
			application_name: "edu-ai-ratelimit",
			statement_timeout: 200,
		},
	});
}

if (!globalForPg.__eduAiPostgres) {
	globalForPg.__eduAiPostgres = createPostgres(connectionString);
}

if (!globalForPg.__eduAiRateLimitPostgres) {
	const rlUrl = process.env.DATABASE_RATELIMIT_URL?.trim() || connectionString;
	globalForPg.__eduAiRateLimitPostgres = createRateLimitPostgres(rlUrl);
}

const client = globalForPg.__eduAiPostgres;
const rateLimitClient = globalForPg.__eduAiRateLimitPostgres;

export const db = drizzle(client, { schema });
export type Db = typeof db;

export const ratelimitDb = drizzle(rateLimitClient, { schema });
export const ratelimitSql = rateLimitClient;
