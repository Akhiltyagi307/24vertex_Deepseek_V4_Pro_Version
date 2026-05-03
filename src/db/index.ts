import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const globalForPg = globalThis as unknown as { __eduAiPostgres?: ReturnType<typeof postgres> };

function parsePoolMax(): number {
	const raw = process.env.DATABASE_POOL_MAX;
	if (raw === undefined || raw === "") return 1;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.min(n, 10);
}

function createPostgres(url: string) {
	const isProd = process.env.NODE_ENV === "production";
	if (!isProd) {
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
	return postgres(url, {
		prepare: false,
		max: parsePoolMax(),
		// Close idle sockets so tabs/HMR and long-lived dev servers release Supabase slots.
		idle_timeout: isProd ? 60 : 20,
		// Recycle connections (seconds). Shorter in dev to shed leaked sessions after churn.
		max_lifetime: isProd ? 60 * 60 : 60 * 5,
		connect_timeout: 15,
		connection: {
			application_name: "edu-ai-next",
		},
	});
}

if (!globalForPg.__eduAiPostgres) {
	globalForPg.__eduAiPostgres = createPostgres(connectionString);
}

const client = globalForPg.__eduAiPostgres;

export const db = drizzle(client, { schema });
export type Db = typeof db;
