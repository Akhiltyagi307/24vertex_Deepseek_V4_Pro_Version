import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/env";

/** Server-only: list curriculum rows where RLS blocks anon (e.g. signup forms). */
export function createServiceRoleClient() {
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) {
		throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
	}
	return createClient(getSupabaseUrl(), key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}

/** Public type alias so non-allowlisted modules can describe a service-role client without importing the constructor. */
export type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;
