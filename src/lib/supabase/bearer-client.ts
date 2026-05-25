import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase client that does not use `next/headers#cookies()`.
 * Use inside `unstable_cache` after reading the session token outside the cache scope.
 */
export function createBearerSupabaseClient(accessToken: string): SupabaseClient {
	return createSupabaseClient(getSupabaseUrl(), getSupabasePublishableKey(), {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
		global: {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	});
}

/** Resolves the current request JWT for cache-safe Supabase reads (call outside `unstable_cache`). */
export async function getServerAccessToken(): Promise<string> {
	const supabase = await createClient();
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();
	if (error || !session?.access_token) {
		throw new Error("Missing authenticated session");
	}
	return session.access_token;
}
