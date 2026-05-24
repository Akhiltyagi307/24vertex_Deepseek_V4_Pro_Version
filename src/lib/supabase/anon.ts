import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

/**
 * Anon-key Supabase client for server contexts that have no request cookies
 * (notably `unstable_cache` work-units, where `next/headers#cookies()` is
 * unavailable). The client runs as the `anon` Postgres role and is bound by
 * the same Row-Level Security policies that gate unauthenticated visits to
 * the public site.
 *
 * Use this when:
 *   - The data is already anon-readable via RLS (curriculum, marketing copy,
 *     public organization catalog, etc.)
 *   - You need to call from inside `unstable_cache` / `revalidateTag`
 *
 * Do NOT use this when:
 *   - The data is user-scoped — use `@/lib/supabase/server#createClient`
 *     which has the request cookies and runs as `authenticated`.
 *   - You need to bypass RLS — use `@/lib/supabase/admin#createServiceRoleClient`
 *     and only from an allowlisted file.
 */
export function createAnonClient() {
	return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}

export type AnonSupabaseClient = ReturnType<typeof createAnonClient>;
